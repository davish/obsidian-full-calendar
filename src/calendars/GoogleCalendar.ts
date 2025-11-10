import { TFile, TFolder } from "obsidian";
import { EventPathLocation } from "../core/EventStore";
import { ObsidianInterface } from "../ObsidianAdapter";
import { EventLocation, OFCEvent } from "../types";
import { EditableCalendar, EditableEventResponse } from "./EditableCalendar";
import FullNoteCalendar from "./FullNoteCalendar";
import {
    GoogleCalendarSync,
    GoogleOAuthConfig,
    SyncState,
} from "../sync/GoogleCalendarSync";

/**
 * Google Calendar implementation that extends EditableCalendar.
 *
 * This calendar stores events locally in markdown files (using FullNoteCalendar)
 * and syncs changes to Google Calendar automatically.
 */
export default class GoogleCalendar extends EditableCalendar {
    private localCalendar: FullNoteCalendar;
    private syncService: GoogleCalendarSync | null = null;
    private syncEnabled: boolean;
    private calendarId: string;
    private oauthConfig: GoogleOAuthConfig;

    constructor(
        app: ObsidianInterface,
        color: string,
        directory: string,
        calendarId: string,
        syncEnabled: boolean,
        oauthConfig: GoogleOAuthConfig,
        accessToken?: string,
        refreshToken?: string,
        tokenExpiry?: number
    ) {
        super(color);

        // Use FullNoteCalendar internally for local storage
        this.localCalendar = new FullNoteCalendar(app, color, directory);
        this.calendarId = calendarId;
        this.syncEnabled = syncEnabled;
        this.oauthConfig = oauthConfig;

        // Initialize sync service if we have credentials
        if (syncEnabled && accessToken && refreshToken) {
            this.syncService = new GoogleCalendarSync(
                oauthConfig,
                calendarId,
                accessToken,
                refreshToken,
                tokenExpiry
            );
        }
    }

    get type(): "google" {
        return "google";
    }

    get identifier(): string {
        return this.directory;
    }

    get name(): string {
        return `${this.directory} (Google)`;
    }

    get directory(): string {
        return this.localCalendar.directory;
    }

    /**
     * Initialize sync service with OAuth credentials
     */
    initializeSync(
        accessToken: string,
        refreshToken: string,
        tokenExpiry?: number
    ): void {
        this.syncService = new GoogleCalendarSync(
            this.oauthConfig,
            this.calendarId,
            accessToken,
            refreshToken,
            tokenExpiry
        );
        this.syncEnabled = true;
    }

    /**
     * Get OAuth URL for authentication
     */
    getAuthUrl(): string {
        if (!this.syncService) {
            // Create temporary sync service just to get auth URL
            const tempSync = new GoogleCalendarSync(
                this.oauthConfig,
                this.calendarId
            );
            return tempSync.getAuthUrl();
        }
        return this.syncService.getAuthUrl();
    }

    /**
     * Complete OAuth flow with authorization code
     */
    async authenticateWithCode(code: string): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenExpiry: number;
    }> {
        if (!this.syncService) {
            // Create temporary sync service for authentication
            this.syncService = new GoogleCalendarSync(
                this.oauthConfig,
                this.calendarId
            );
        }
        const tokens = await this.syncService.authenticateWithCode(code);
        this.syncEnabled = true;
        return tokens;
    }

    /**
     * Check if sync is properly configured and authenticated
     */
    isSyncReady(): boolean {
        return (
            this.syncEnabled &&
            !!this.syncService &&
            this.syncService.isAuthenticated()
        );
    }

    /**
     * Get current sync state
     */
    getSyncState(): SyncState | null {
        return this.syncService?.getSyncState() || null;
    }

    /**
     * Load sync state
     */
    loadSyncState(state: SyncState): void {
        if (this.syncService) {
            this.syncService.loadSyncState(state);
        } else {
            console.warn(
                "Cannot load sync state: sync service not initialized for directory:",
                this.directory
            );
        }
    }

    /**
     * Get updated credentials (in case token was refreshed)
     */
    getCredentials(): {
        accessToken?: string;
        refreshToken?: string;
        tokenExpiry?: number;
    } {
        return this.syncService?.getCredentials() || {};
    }

    // EditableCalendar implementation

    async getEvents(): Promise<EditableEventResponse[]> {
        // Ensure directory exists before getting events
        const directory = this.directory;
        let folder = this.localCalendar.app.getAbstractFileByPath(directory);

        if (!folder || !(folder instanceof TFolder)) {
            // Directory doesn't exist, create it
            try {
                await this.localCalendar.app.createFolder(directory);
            } catch (error: any) {
                // Ignore "folder already exists" errors (race condition)
                // If the error is something else, we'll let it propagate
                if (
                    error?.message &&
                    !error.message.includes("already exists")
                ) {
                    throw error;
                }
            }

            // Wait for Obsidian to update its cache, then verify
            // Retry multiple times with increasing delays in case of timing issues
            for (let i = 0; i < 10; i++) {
                folder =
                    this.localCalendar.app.getAbstractFileByPath(directory);
                if (folder && folder instanceof TFolder) {
                    break;
                }
                // Wait with exponential backoff: 50ms, 100ms, 150ms, etc.
                await new Promise((resolve) =>
                    setTimeout(resolve, 50 + i * 50)
                );
            }

            // Final check - if folder still doesn't exist, return empty array
            // This prevents the error from propagating and allows sync to continue
            folder = this.localCalendar.app.getAbstractFileByPath(directory);
            if (!folder || !(folder instanceof TFolder)) {
                console.warn(
                    `Directory ${directory} still not available after creation, returning empty events`
                );
                return [];
            }
        }

        return this.localCalendar.getEvents();
    }

    async getEventsInFile(file: TFile): Promise<EditableEventResponse[]> {
        return this.localCalendar.getEventsInFile(file);
    }

    async createEvent(event: OFCEvent): Promise<EventLocation> {
        // Create locally first
        const location = await this.localCalendar.createEvent(event);

        // Don't sync immediately - let the periodic sync handle it
        // This prevents duplicate events because:
        // 1. The event might not have an ID yet when created
        // 2. The periodic sync will pick it up once it has an ID and proper mapping
        // If immediate sync is needed, it should happen after the event has an ID
        // and the file system has been updated

        return location;
    }

    /**
     * Best-effort remote deletion using multiple possible mapping keys
     * Keys may be: explicit event.id, full file path, or filename
     */
    async deleteByKeys(possibleKeys: string[]): Promise<void> {
        if (!this.isSyncReady() || !this.syncService) {
            return;
        }
        const uniqueKeys = Array.from(
            new Set(
                possibleKeys.filter((k): k is string => !!k && k.length > 0)
            )
        );
        const state = this.syncService.getSyncState();
        const allMappingKeys = Object.keys(state.eventMapping);

        // Try exact match first
        for (const key of uniqueKeys) {
            const mapped = state.eventMapping[key];
            if (mapped) {
                try {
                    await this.syncService.deleteEvent(key);
                    return;
                } catch (err) {
                    console.warn("Failed to delete event by key:", key, err);
                }
            }
        }

        // Try fuzzy match (case-insensitive, partial match)
        for (const key of uniqueKeys) {
            const match = Object.keys(state.eventMapping).find(
                (k) =>
                    k === key ||
                    k.toLowerCase() === key.toLowerCase() ||
                    k.endsWith(key) ||
                    key.endsWith(k) ||
                    k.includes(key) ||
                    key.includes(k)
            );
            if (match) {
                try {
                    await this.syncService.deleteEvent(match);
                    return;
                } catch (err) {
                    console.warn(
                        "Failed to delete event by fuzzy match:",
                        match,
                        err
                    );
                }
            }
        }

        // Last resort: query Google Calendar directly by filename
        // Extract date and title from filename (format: YYYY-MM-DD Title.md)
        if (uniqueKeys.length > 0) {
            const filename =
                uniqueKeys
                    .find((k) => k.includes("/"))
                    ?.split("/")
                    .pop() || uniqueKeys[0];
            const dateMatch = filename.match(
                /^(\d{4}-\d{2}-\d{2})\s+(.+?)\.md$/
            );
            if (dateMatch) {
                const [, dateStr, title] = dateMatch;
                try {
                    const foundEventId =
                        await this.syncService?.findEventByTitleAndDate(
                            title,
                            dateStr
                        );
                    if (foundEventId) {
                        await this.syncService?.deleteEventByGoogleId(
                            foundEventId
                        );
                        return;
                    }
                } catch (err) {
                    console.warn(
                        "Failed to query Google Calendar for event:",
                        err
                    );
                }
            }
        }

        console.warn(
            "Could not delete event from Google Calendar. No mapping found and query failed."
        );

        // Add to pending deletions so it can be synced later when online
        if (this.syncService) {
            // Try all possible keys as pending deletions
            for (const key of uniqueKeys) {
                this.syncService.addPendingDeletion(key);
            }
        }
    }

    async deleteEvent(location: EventPathLocation): Promise<void> {
        // Sync deletion to Google Calendar if enabled
        if (this.isSyncReady()) {
            try {
                const filePath = location.path;

                // Try to get the event from the file to check if it has an ID
                // But the file might already be deleted, so we need to try multiple keys
                let eventKey: string | undefined = filePath;
                const file = this.localCalendar.app.getFileByPath(filePath);

                if (file) {
                    try {
                        const events = await this.getEventsInFile(file);
                        if (events.length > 0) {
                            const [event] = events[0];
                            // Use event.id if available, otherwise use file path
                            eventKey = event.id || filePath;
                        }
                    } catch (error) {
                        // File might already be deleted, continue with file path
                    }
                }

                const possibleKeys = [
                    eventKey,
                    filePath,
                    filePath.replace(/^.*\//, ""),
                ];
                try {
                    await this.deleteByKeys(possibleKeys);
                } catch (error) {
                    console.error(
                        "Failed to delete event from Google Calendar:",
                        error
                    );
                    // Add to pending deletions for later sync
                    if (this.syncService) {
                        for (const key of possibleKeys) {
                            if (key) {
                                this.syncService.addPendingDeletion(key);
                            }
                        }
                    }
                    // Don't throw - local deletion should still proceed
                }
            } catch (error) {
                console.error(
                    "Failed to delete event from Google Calendar:",
                    error
                );
                // Don't throw - local deletion should still proceed
            }
        }

        // Delete locally
        await this.localCalendar.deleteEvent(location);
    }

    async modifyEvent(
        location: EventPathLocation,
        newEvent: OFCEvent,
        updateCacheWithLocation: (loc: EventLocation) => void
    ): Promise<void> {
        // Modify locally first
        await this.localCalendar.modifyEvent(
            location,
            newEvent,
            updateCacheWithLocation
        );

        // Then sync to Google Calendar if enabled
        if (this.isSyncReady()) {
            try {
                await this.syncService!.syncEvent(newEvent);
            } catch (error) {
                console.error(
                    "Failed to sync modified event to Google Calendar:",
                    error
                );
                // Don't throw - local event was modified successfully
            }
        }
    }

    /**
     * Manually trigger a full sync of all events
     */
    async syncAllEvents(): Promise<void> {
        if (!this.isSyncReady()) {
            throw new Error("Sync is not enabled or authenticated");
        }

        const events = await this.getEvents();
        // Pass events with their file paths for stable identification
        const eventsWithPaths = events.map(([event, location]) => ({
            event,
            filePath: location?.file?.path,
        }));
        // Don't show notice here - let the caller (SyncScheduler or manual sync) handle it
        await this.syncService!.syncEventsWithPaths(eventsWithPaths, false);
    }

    /**
     * Enable or disable sync
     */
    setSyncEnabled(enabled: boolean): void {
        this.syncEnabled = enabled;
    }
}
