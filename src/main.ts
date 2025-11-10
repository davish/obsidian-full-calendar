import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import {
    CalendarView,
    FULL_CALENDAR_SIDEBAR_VIEW_TYPE,
    FULL_CALENDAR_VIEW_TYPE,
} from "./ui/view";
import { renderCalendar } from "./ui/calendar";
import { toEventInput } from "./ui/interop";
import {
    DEFAULT_SETTINGS,
    FullCalendarSettings,
    FullCalendarSettingTab,
} from "./ui/settings";
import { PLUGIN_SLUG, CalendarInfo } from "./types";
import EventCache from "./core/EventCache";
import { ObsidianIO } from "./ObsidianAdapter";
import { launchCreateModal } from "./ui/event_modal";
import FullNoteCalendar from "./calendars/FullNoteCalendar";
import DailyNoteCalendar from "./calendars/DailyNoteCalendar";
import ICSCalendar from "./calendars/ICSCalendar";
import CalDAVCalendar from "./calendars/CalDAVCalendar";
import GoogleCalendar from "./calendars/GoogleCalendar";
import { SyncScheduler } from "./sync/SyncScheduler";

export default class FullCalendarPlugin extends Plugin {
    settings: FullCalendarSettings = DEFAULT_SETTINGS;
    syncScheduler: SyncScheduler | null = null;
    cache: EventCache = new EventCache({
        local: (info) =>
            info.type === "local"
                ? new FullNoteCalendar(
                      new ObsidianIO(this.app),
                      info.color,
                      info.directory
                  )
                : null,
        dailynote: (info) =>
            info.type === "dailynote"
                ? new DailyNoteCalendar(
                      new ObsidianIO(this.app),
                      info.color,
                      info.heading
                  )
                : null,
        ical: (info) =>
            info.type === "ical" ? new ICSCalendar(info.color, info.url) : null,
        caldav: (info) =>
            info.type === "caldav"
                ? new CalDAVCalendar(
                      info.color,
                      info.name,
                      {
                          type: "basic",
                          username: info.username,
                          password: info.password,
                      },
                      info.url,
                      info.homeUrl
                  )
                : null,
        google: (info) => {
            if (info.type !== "google") return null;

            const oauthConfig = this.settings.googleOAuth || {
                clientId: "",
                clientSecret: "",
                redirectUri: "http://localhost",
            };

            const calendar = new GoogleCalendar(
                new ObsidianIO(this.app),
                info.color,
                info.directory,
                info.calendarId,
                info.syncEnabled || false,
                oauthConfig,
                info.accessToken,
                info.refreshToken,
                info.tokenExpiry
            );

            // Load sync state if it exists
            const syncState = this.settings.googleSyncStates?.[info.directory];
            if (syncState) {
                // Ensure pendingDeletions exists for backward compatibility
                const stateWithPending = {
                    ...syncState,
                    pendingDeletions: syncState.pendingDeletions || [],
                };
                calendar.loadSyncState(stateWithPending);
            }

            // Register with sync scheduler
            if (info.syncEnabled && this.syncScheduler) {
                this.syncScheduler.registerCalendar(calendar);
            }

            return calendar;
        },
        FOR_TEST_ONLY: () => null,
    });

    renderCalendar = renderCalendar;
    processFrontmatter = toEventInput;

    async activateView() {
        const leaves = this.app.workspace
            .getLeavesOfType(FULL_CALENDAR_VIEW_TYPE)
            .filter((l) => (l.view as CalendarView).inSidebar === false);
        if (leaves.length === 0) {
            const leaf = this.app.workspace.getLeaf("tab");
            await leaf.setViewState({
                type: FULL_CALENDAR_VIEW_TYPE,
                active: true,
            });
        } else {
            await Promise.all(
                leaves.map((l) => (l.view as CalendarView).onOpen())
            );
        }
    }
    async onload() {
        await this.loadSettings();

        // Initialize sync scheduler for Google Calendar
        const googleCalendars = this.settings.calendarSources.filter(
            (cal): cal is Extract<CalendarInfo, { type: "google" }> =>
                cal.type === "google" && (cal.syncEnabled ?? false)
        );
        if (googleCalendars.length > 0) {
            const syncInterval = googleCalendars[0].syncIntervalMinutes ?? 5;
            this.syncScheduler = new SyncScheduler(syncInterval, this);
        }

        this.cache.reset(this.settings.calendarSources);

        // Start sync scheduler if we have Google calendars
        if (this.syncScheduler) {
            this.syncScheduler.start();
        }

        this.registerEvent(
            this.app.metadataCache.on("changed", (file) => {
                this.cache.fileUpdated(file);
            })
        );

        this.registerEvent(
            this.app.vault.on("rename", async (file, oldPath) => {
                if (file instanceof TFile) {
                    console.debug("FILE RENAMED", file.path);
                    await this.cache.deleteEventsAtPath(oldPath);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on("delete", async (file) => {
                if (file instanceof TFile) {
                    console.debug("FILE DELETED", file.path);
                    await this.cache.deleteEventsAtPath(file.path);
                }
            })
        );

        // @ts-ignore
        window.cache = this.cache;

        this.registerView(
            FULL_CALENDAR_VIEW_TYPE,
            (leaf) => new CalendarView(leaf, this, false)
        );

        this.registerView(
            FULL_CALENDAR_SIDEBAR_VIEW_TYPE,
            (leaf) => new CalendarView(leaf, this, true)
        );

        this.addRibbonIcon(
            "calendar-glyph",
            "Open Full Calendar",
            async (_: MouseEvent) => {
                await this.activateView();
            }
        );

        this.addSettingTab(new FullCalendarSettingTab(this.app, this));

        this.addCommand({
            id: "full-calendar-new-event",
            name: "New Event",
            callback: () => {
                launchCreateModal(this, {});
            },
        });

        this.addCommand({
            id: "full-calendar-reset",
            name: "Reset Event Cache",
            callback: () => {
                this.cache.reset(this.settings.calendarSources);
                this.app.workspace.detachLeavesOfType(FULL_CALENDAR_VIEW_TYPE);
                this.app.workspace.detachLeavesOfType(
                    FULL_CALENDAR_SIDEBAR_VIEW_TYPE
                );
                new Notice("Full Calendar has been reset.");
            },
        });

        this.addCommand({
            id: "full-calendar-revalidate",
            name: "Revalidate remote calendars",
            callback: () => {
                this.cache.revalidateRemoteCalendars(true);
            },
        });

        this.addCommand({
            id: "full-calendar-sync-google",
            name: "Sync Google Calendar",
            callback: async () => {
                if (!this.syncScheduler) {
                    new Notice("Sync scheduler not available.");
                    return;
                }
                try {
                    new Notice("Syncing Google Calendar...");
                    await this.syncScheduler.syncAll();
                    new Notice("Google Calendar sync completed!");
                } catch (error: any) {
                    console.error("Sync failed:", error);
                    new Notice(
                        `Sync failed: ${error?.message || "Unknown error"}`
                    );
                }
            },
        });

        this.addCommand({
            id: "full-calendar-open",
            name: "Open Calendar",
            callback: () => {
                this.activateView();
            },
        });

        this.addCommand({
            id: "full-calendar-open-sidebar",
            name: "Open in sidebar",
            callback: () => {
                if (
                    this.app.workspace.getLeavesOfType(
                        FULL_CALENDAR_SIDEBAR_VIEW_TYPE
                    ).length
                ) {
                    return;
                }
                this.app.workspace.getRightLeaf(false).setViewState({
                    type: FULL_CALENDAR_SIDEBAR_VIEW_TYPE,
                });
            },
        });

        (this.app.workspace as any).registerHoverLinkSource(PLUGIN_SLUG, {
            display: "Full Calendar",
            defaultMod: true,
        });
    }

    onunload() {
        // Stop sync scheduler
        if (this.syncScheduler) {
            this.syncScheduler.stop();
        }

        this.app.workspace.detachLeavesOfType(FULL_CALENDAR_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(FULL_CALENDAR_SIDEBAR_VIEW_TYPE);
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        new Notice("Resetting the event cache with new settings...");

        // Save sync states from Google calendars
        const googleCalendars = Array.from(
            this.cache.calendars.values()
        ).filter((cal): cal is GoogleCalendar => cal instanceof GoogleCalendar);

        for (const cal of googleCalendars) {
            const syncState = cal.getSyncState();
            if (syncState) {
                if (!this.settings.googleSyncStates) {
                    this.settings.googleSyncStates = {};
                }
                this.settings.googleSyncStates[cal.directory] = syncState;
            }

            // Update credentials if they were refreshed
            const calInfo = this.settings.calendarSources.find(
                (info) =>
                    info.type === "google" && info.directory === cal.directory
            );
            if (calInfo && calInfo.type === "google") {
                const creds = cal.getCredentials();
                if (creds.accessToken) calInfo.accessToken = creds.accessToken;
                if (creds.refreshToken)
                    calInfo.refreshToken = creds.refreshToken;
                if (creds.tokenExpiry) calInfo.tokenExpiry = creds.tokenExpiry;
            }
        }

        await this.saveData(this.settings);
        this.cache.reset(this.settings.calendarSources);
        await this.cache.populate();
        this.cache.resync();

        // Restart sync scheduler if needed
        if (this.syncScheduler) {
            this.syncScheduler.stop();
        }
        const googleCalendarsEnabled = this.settings.calendarSources.filter(
            (cal): cal is Extract<CalendarInfo, { type: "google" }> =>
                cal.type === "google" && (cal.syncEnabled ?? false)
        );
        if (googleCalendarsEnabled.length > 0) {
            const syncInterval =
                googleCalendarsEnabled[0].syncIntervalMinutes ?? 5;
            this.syncScheduler = new SyncScheduler(syncInterval, this);
            this.syncScheduler.start();
        }
    }
}
