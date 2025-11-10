import { Notice } from "obsidian";
import GoogleCalendar from "../calendars/GoogleCalendar";
import type FullCalendarPlugin from "../main";

/**
 * Manages automatic periodic syncing of Google Calendar
 */
export class SyncScheduler {
    private intervalId: number | null = null;
    private intervalMinutes: number;
    private googleCalendars: GoogleCalendar[] = [];
    private isRunning: boolean = false;
    private plugin: FullCalendarPlugin | null = null;

    constructor(intervalMinutes: number = 5, plugin?: FullCalendarPlugin) {
        this.intervalMinutes = intervalMinutes;
        this.plugin = plugin || null;
    }

    /**
     * Register a Google Calendar for auto-sync
     */
    registerCalendar(calendar: GoogleCalendar): void {
        if (!this.googleCalendars.includes(calendar)) {
            this.googleCalendars.push(calendar);
        }
    }

    /**
     * Unregister a Google Calendar from auto-sync
     */
    unregisterCalendar(calendar: GoogleCalendar): void {
        const index = this.googleCalendars.indexOf(calendar);
        if (index > -1) {
            this.googleCalendars.splice(index, 1);
        }
    }

    /**
     * Update sync interval
     */
    setInterval(minutes: number): void {
        this.intervalMinutes = minutes;
        if (this.isRunning) {
            // Restart with new interval
            this.stop();
            this.start();
        }
    }

    /**
     * Start automatic syncing
     */
    start(): void {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        // Run initial sync
        this.syncAll();

        // Schedule periodic syncs
        this.intervalId = window.setInterval(
            () => {
                this.syncAll();
            },
            this.intervalMinutes * 60 * 1000 // Convert minutes to milliseconds
        );
    }

    /**
     * Stop automatic syncing
     */
    stop(): void {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
    }

    /**
     * Manually trigger sync for a specific calendar by directory
     */
    async syncCalendarByDirectory(directory: string): Promise<void> {
        const calendar = this.googleCalendars.find(
            (cal) => cal.directory === directory && cal.isSyncReady()
        );

        if (!calendar) {
            throw new Error(
                `Calendar with directory "${directory}" not found or not ready for sync`
            );
        }

        await calendar.syncAllEvents();

        // Save sync state after syncing
        if (this.plugin) {
            await this.saveSyncState();
        }
    }

    /**
     * Manually trigger sync for all registered calendars
     */
    async syncAll(): Promise<void> {
        const calendarsToSync = this.googleCalendars.filter((cal) =>
            cal.isSyncReady()
        );

        if (calendarsToSync.length === 0) {
            return;
        }

        const results = await Promise.allSettled(
            calendarsToSync.map((calendar) => calendar.syncAllEvents())
        );

        const succeeded = results.filter(
            (r) => r.status === "fulfilled"
        ).length;
        const failed = results.filter((r) => r.status === "rejected").length;

        if (failed > 0) {
            console.error(
                `Google Calendar sync: ${succeeded} succeeded, ${failed} failed`
            );
            results.forEach((result, index) => {
                if (result.status === "rejected") {
                    console.error(
                        `Calendar ${calendarsToSync[index].name} sync failed:`,
                        result.reason
                    );
                }
            });

            // Show error notice if any syncs failed
            new Notice(
                `Google Calendar sync: ${failed} calendar(s) failed to sync`
            );
        }

        // Save sync state after syncing
        if (this.plugin) {
            await this.saveSyncState();
        }
    }

    /**
     * Save sync state to plugin settings without resetting cache
     */
    private async saveSyncState(): Promise<void> {
        if (!this.plugin) return;

        // Save sync states from Google calendars
        for (const cal of this.googleCalendars) {
            const syncState = cal.getSyncState();
            if (syncState) {
                if (!this.plugin.settings.googleSyncStates) {
                    this.plugin.settings.googleSyncStates = {};
                }
                // Deep copy to ensure proper serialization
                this.plugin.settings.googleSyncStates[cal.directory] = {
                    lastSyncTime: syncState.lastSyncTime,
                    eventMapping: { ...syncState.eventMapping }, // Deep copy
                    pendingDeletions: syncState.pendingDeletions
                        ? [...syncState.pendingDeletions]
                        : [],
                };
            }

            // Update credentials if they were refreshed
            const calInfo = this.plugin.settings.calendarSources.find(
                (info: any) =>
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

        // Save settings without resetting cache
        await this.plugin.saveData(this.plugin.settings);
    }

    /**
     * Check if scheduler is running
     */
    get running(): boolean {
        return this.isRunning;
    }

    /**
     * Get number of registered calendars
     */
    get calendarCount(): number {
        return this.googleCalendars.length;
    }
}
