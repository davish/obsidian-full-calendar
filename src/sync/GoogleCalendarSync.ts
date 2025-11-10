import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { Notice } from "obsidian";
import { OFCEvent } from "src/types";
import { DateTime } from "luxon";

/**
 * Google Calendar OAuth configuration
 * Users will need to create their own OAuth credentials at:
 * https://console.cloud.google.com/apis/credentials
 */
export interface GoogleOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

/**
 * Sync state for tracking what's been synced
 */
export interface SyncState {
    lastSyncTime: number;
    eventMapping: {
        [obsidianEventId: string]: string; // Maps Obsidian event ID to Google Calendar event ID
    };
    pendingDeletions: string[]; // Event keys that need to be deleted from Google Calendar
}

/**
 * Service for syncing Obsidian Full Calendar events to Google Calendar
 */
export class GoogleCalendarSync {
    private oauth2Client: OAuth2Client;
    private calendar: calendar_v3.Calendar;
    private syncState: SyncState;
    // Track events currently being synced to prevent duplicates
    private syncingEvents: Map<string, Promise<string | null>> = new Map();

    constructor(
        private config: GoogleOAuthConfig,
        private calendarId: string,
        private accessToken?: string,
        private refreshToken?: string,
        private tokenExpiry?: number
    ) {
        this.oauth2Client = new google.auth.OAuth2(
            config.clientId,
            config.clientSecret,
            config.redirectUri
        );

        // Set credentials if we have them
        if (accessToken && refreshToken) {
            this.oauth2Client.setCredentials({
                access_token: accessToken,
                refresh_token: refreshToken,
                expiry_date: tokenExpiry,
            });
        }

        this.calendar = google.calendar({
            version: "v3",
            auth: this.oauth2Client,
        });
        this.syncState = {
            lastSyncTime: 0,
            eventMapping: {},
            pendingDeletions: [],
        };
    }

    /**
     * Generate OAuth URL for user authentication
     */
    getAuthUrl(): string {
        const scopes = ["https://www.googleapis.com/auth/calendar"];
        // For desktop apps, use http://localhost (Google handles this automatically)
        const redirectUri = this.config.redirectUri || "http://localhost";
        return this.oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopes,
            prompt: "consent", // Force consent to get refresh token
            redirect_uri: redirectUri, // Explicitly include redirect URI
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async authenticateWithCode(code: string): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenExpiry: number;
    }> {
        try {
            // Explicitly include redirect_uri in token exchange
            // This is required even though it was in the auth URL
            const redirectUri = this.config.redirectUri || "http://localhost";
            const { tokens } = await this.oauth2Client.getToken({
                code: code,
                redirect_uri: redirectUri,
            });
            this.oauth2Client.setCredentials(tokens);

            if (!tokens.access_token) {
                throw new Error("No access token received from Google");
            }

            if (!tokens.refresh_token) {
                console.warn(
                    "No refresh token received. You may need to revoke access and re-authenticate."
                );
            }

            return {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || "",
                tokenExpiry: tokens.expiry_date || Date.now() + 3600000, // Default 1 hour if not provided
            };
        } catch (error: any) {
            console.error("Error authenticating with Google:", error);

            // Extract more detailed error message
            let errorMessage = "Failed to authenticate with Google Calendar";
            if (error?.response?.data?.error_description) {
                errorMessage = error.response.data.error_description;
            } else if (error?.response?.data?.error) {
                errorMessage = `${error.response.data.error}: ${
                    error.response.data.error_description || ""
                }`;
            } else if (error?.message) {
                errorMessage = error.message;
            } else if (typeof error === "string") {
                errorMessage = error;
            }

            throw new Error(errorMessage);
        }
    }

    /**
     * Check if we're authenticated
     */
    isAuthenticated(): boolean {
        return !!this.oauth2Client.credentials.access_token;
    }

    /**
     * Refresh access token if needed
     */
    private async refreshTokenIfNeeded(): Promise<void> {
        try {
            const credentials = this.oauth2Client.credentials;
            if (
                credentials.expiry_date &&
                Date.now() >= credentials.expiry_date - 60000
            ) {
                // Refresh if expires in less than 1 minute
                const { credentials: newCredentials } =
                    await this.oauth2Client.refreshAccessToken();
                this.oauth2Client.setCredentials(newCredentials);
            }
        } catch (error) {
            console.error("Error refreshing token:", error);
            throw new Error("Failed to refresh Google Calendar access token");
        }
    }

    /**
     * Convert Obsidian event to Google Calendar event format
     */
    private convertToGoogleEvent(event: OFCEvent): any {
        const googleEvent: any = {
            summary: event.title,
            // Note: Don't set 'id' - Google Calendar generates its own IDs
            // We track the mapping in syncState.eventMapping instead
        };

        if (event.type === "single") {
            const date = DateTime.fromISO(event.date);

            if (event.allDay) {
                googleEvent.start = { date: date.toFormat("yyyy-MM-dd") };
                if (event.endDate) {
                    const endDate = DateTime.fromISO(event.endDate);
                    googleEvent.end = { date: endDate.toFormat("yyyy-MM-dd") };
                } else {
                    googleEvent.end = {
                        date: date.plus({ days: 1 }).toFormat("yyyy-MM-dd"),
                    };
                }
            } else {
                // Timed event
                const startTime = event.startTime;
                const endTime = event.endTime;

                if (startTime) {
                    const [hours, minutes] = startTime.split(":");
                    const startDateTime = date
                        .set({
                            hour: parseInt(hours),
                            minute: parseInt(minutes),
                        })
                        .toISO();
                    googleEvent.start = { dateTime: startDateTime };
                }

                if (endTime && startTime) {
                    const [hours, minutes] = endTime.split(":");
                    const endDateTime = date
                        .set({
                            hour: parseInt(hours),
                            minute: parseInt(minutes),
                        })
                        .toISO();
                    googleEvent.end = { dateTime: endDateTime };
                } else if (startTime) {
                    // Default to 1 hour duration
                    const [hours, minutes] = startTime.split(":");
                    const endDateTime = date
                        .set({
                            hour: parseInt(hours) + 1,
                            minute: parseInt(minutes),
                        })
                        .toISO();
                    googleEvent.end = { dateTime: endDateTime };
                }
            }
        }

        // Note: Recurring events would need additional handling with RRULE format
        // For now, we'll only sync single events

        return googleEvent;
    }

    /**
     * Generate a key from event title and date for deduplication
     */
    private getTitleDateKey(event: OFCEvent): string | null {
        if (!event.title) {
            return null;
        }
        // Get date string - handle different event types
        let dateStr: string | null = null;
        if (event.type === "single") {
            // For single events, always use the date property
            dateStr = event.date;
        } else if (event.type === "rrule") {
            // For recurring events, use startDate
            dateStr = event.startDate || null;
        }

        if (!dateStr) {
            return null;
        }
        return `${event.title}|${dateStr}`;
    }

    /**
     * Sync a single event to Google Calendar
     * Uses synchronization to prevent duplicate creation when same event is synced in parallel
     */
    async syncEvent(
        event: OFCEvent,
        filePath?: string
    ): Promise<string | null> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        if (event.type !== "single") {
            // Only sync single events for now
            return null;
        }

        try {
            // Token refresh is handled at batch level, but check if needed here too
            // (in case token expired during parallel processing)
            await this.refreshTokenIfNeeded();

            const googleEvent = this.convertToGoogleEvent(event);

            // Use file path as primary key if available, then event.id as fallback
            // This ensures consistent key usage even when event.id changes
            // Priority: filePath > event.id (because filePath is more stable)
            const eventKey = filePath || event.id || null;
            if (!eventKey) {
                console.warn(
                    "Event has no ID or file path, cannot track mapping:",
                    event.title
                );
                // Still sync it, but we can't track it
                const response = await this.calendar.events.insert({
                    calendarId: this.calendarId,
                    requestBody: googleEvent,
                });
                return response.data.id || null;
            }

            // If we have both filePath and event.id, check if event.id is already mapped
            // and if so, migrate the mapping to use filePath as the key
            if (filePath && event.id && event.id !== filePath) {
                const existingMappingByEventId =
                    this.syncState.eventMapping[event.id];
                if (
                    existingMappingByEventId &&
                    !this.syncState.eventMapping[filePath]
                ) {
                    // Migrate mapping from event.id to filePath for consistency
                    this.syncState.eventMapping[filePath] =
                        existingMappingByEventId;
                    // Keep event.id mapping as well for backward compatibility, but prefer filePath
                }
            }

            // Check if this event is already being synced by another parallel operation
            const existingSync = this.syncingEvents.get(eventKey);
            if (existingSync) {
                const result = await existingSync;
                // Double-check mapping after waiting (in case it was added during sync)
                if (this.syncState.eventMapping[eventKey]) {
                    return this.syncState.eventMapping[eventKey];
                }
                return result;
            }

            // Create a sync promise and store it
            const syncPromise = this.performSyncEvent(
                event,
                googleEvent,
                eventKey
            );
            this.syncingEvents.set(eventKey, syncPromise);

            try {
                const result = await syncPromise;
                return result;
            } finally {
                // Remove from syncing map when done
                this.syncingEvents.delete(eventKey);
            }
        } catch (error: any) {
            console.error("Error syncing event to Google Calendar:", error);

            // Extract detailed error message
            let errorMessage = "Failed to sync event to Google Calendar";
            if (error?.response?.data?.error?.message) {
                errorMessage = error.response.data.error.message;
            } else if (error?.message) {
                errorMessage = error.message;
            }

            throw new Error(errorMessage);
        }
    }

    /**
     * Internal method to perform the actual sync operation
     */
    private async performSyncEvent(
        event: OFCEvent,
        googleEvent: any,
        eventKey: string
    ): Promise<string | null> {
        const existingGoogleId = this.syncState.eventMapping[eventKey];

        if (existingGoogleId) {
            // Update existing event
            const response = await this.calendar.events.update({
                calendarId: this.calendarId,
                eventId: existingGoogleId,
                requestBody: googleEvent,
            });
            return response.data.id || null;
        } else {
            // Before creating, check if an event with the same title and date already exists in Google Calendar
            // This helps prevent duplicates if the mapping was lost
            try {
                let timeMin: string | undefined;
                let timeMax: string | undefined;

                if (googleEvent.start?.dateTime) {
                    // Already in ISO format
                    timeMin = googleEvent.start.dateTime;
                } else if (googleEvent.start?.date) {
                    // All-day event - convert to ISO format with time
                    timeMin = `${googleEvent.start.date}T00:00:00Z`;
                }

                if (googleEvent.end?.dateTime) {
                    timeMax = googleEvent.end.dateTime;
                } else if (googleEvent.end?.date) {
                    timeMax = `${googleEvent.end.date}T23:59:59Z`;
                }

                if (timeMin) {
                    const listResponse = await this.calendar.events.list({
                        calendarId: this.calendarId,
                        timeMin: timeMin,
                        timeMax: timeMax,
                        maxResults: 10,
                        singleEvents: true,
                        orderBy: "startTime",
                    });

                    // Check if an event with the same title already exists
                    const existingEvent = listResponse.data.items?.find(
                        (item: any) => item.summary === event.title
                    );

                    if (existingEvent && existingEvent.id) {
                        // Double-check mapping wasn't added by another parallel sync
                        if (this.syncState.eventMapping[eventKey]) {
                            return this.syncState.eventMapping[eventKey];
                        }
                        // Update the existing event and track the mapping
                        const response = await this.calendar.events.update({
                            calendarId: this.calendarId,
                            eventId: existingEvent.id,
                            requestBody: googleEvent,
                        });
                        const googleId = response.data.id || null;
                        if (googleId) {
                            this.syncState.eventMapping[eventKey] = googleId;
                        }
                        return googleId;
                    }
                }
            } catch (error: any) {
                console.warn(
                    "Error checking for existing events in Google Calendar:",
                    error?.message || error
                );
                // Continue with creating a new event
            }

            // Double-check mapping wasn't added by another parallel sync before creating
            const doubleCheckMapping = this.syncState.eventMapping[eventKey];
            if (doubleCheckMapping) {
                return doubleCheckMapping;
            }

            // Final check: Query Google Calendar one more time right before creating
            // This catches cases where another instance just created the event
            try {
                let timeMin: string | undefined;
                let timeMax: string | undefined;

                if (googleEvent.start?.dateTime) {
                    timeMin = googleEvent.start.dateTime;
                } else if (googleEvent.start?.date) {
                    timeMin = `${googleEvent.start.date}T00:00:00Z`;
                }

                if (googleEvent.end?.dateTime) {
                    timeMax = googleEvent.end.dateTime;
                } else if (googleEvent.end?.date) {
                    timeMax = `${googleEvent.end.date}T23:59:59Z`;
                }

                if (timeMin) {
                    const finalCheckResponse = await this.calendar.events.list({
                        calendarId: this.calendarId,
                        timeMin: timeMin,
                        timeMax: timeMax,
                        maxResults: 10,
                        singleEvents: true,
                        orderBy: "startTime",
                    });

                    const existingEvent = finalCheckResponse.data.items?.find(
                        (item: any) => item.summary === event.title
                    );

                    if (existingEvent && existingEvent.id) {
                        // Update mapping and return existing event ID
                        this.syncState.eventMapping[eventKey] =
                            existingEvent.id;
                        return existingEvent.id;
                    }
                }
            } catch (error: any) {
                console.warn(
                    "Error in final check before creating event:",
                    error?.message || error
                );
                // Continue with creation if check fails
            }

            // Create new event
            const response = await this.calendar.events.insert({
                calendarId: this.calendarId,
                requestBody: googleEvent,
            });

            // Double-check again before adding mapping (race condition protection)
            // Also check if another instance created an event with the same title/date
            const createdEventId = response.data.id;
            if (this.syncState.eventMapping[eventKey]) {
                // Another parallel sync already created this event, delete the duplicate we just created
                if (createdEventId) {
                    console.warn(
                        `Duplicate event detected for ${eventKey}, deleting duplicate: ${createdEventId}`
                    );
                    try {
                        await this.calendar.events.delete({
                            calendarId: this.calendarId,
                            eventId: createdEventId,
                        });
                    } catch (deleteError) {
                        console.warn(
                            "Failed to delete duplicate event:",
                            deleteError
                        );
                    }
                }
                return this.syncState.eventMapping[eventKey];
            }

            // Final safety check: Query Google Calendar one more time after creation
            // to see if another instance created a duplicate
            try {
                let timeMin: string | undefined;
                let timeMax: string | undefined;

                if (googleEvent.start?.dateTime) {
                    timeMin = googleEvent.start.dateTime;
                } else if (googleEvent.start?.date) {
                    timeMin = `${googleEvent.start.date}T00:00:00Z`;
                }

                if (googleEvent.end?.dateTime) {
                    timeMax = googleEvent.end.dateTime;
                } else if (googleEvent.end?.date) {
                    timeMax = `${googleEvent.end.date}T23:59:59Z`;
                }

                if (timeMin) {
                    const postCreateCheck = await this.calendar.events.list({
                        calendarId: this.calendarId,
                        timeMin: timeMin,
                        timeMax: timeMax,
                        maxResults: 10,
                        singleEvents: true,
                        orderBy: "startTime",
                    });

                    const matchingEvents =
                        postCreateCheck.data.items?.filter(
                            (item: any) => item.summary === event.title
                        ) || [];

                    if (matchingEvents.length > 1 && createdEventId) {
                        // Multiple events with same title/date found - we created a duplicate
                        // Keep the first one (oldest), delete ours
                        const otherEvent = matchingEvents.find(
                            (item: any) => item.id !== createdEventId
                        );
                        if (otherEvent && otherEvent.id) {
                            console.warn(
                                `Multiple events with same title/date found, deleting duplicate: ${createdEventId}`
                            );
                            try {
                                await this.calendar.events.delete({
                                    calendarId: this.calendarId,
                                    eventId: createdEventId,
                                });
                                // Use the other event's ID
                                this.syncState.eventMapping[eventKey] =
                                    otherEvent.id;
                                return otherEvent.id;
                            } catch (deleteError) {
                                console.warn(
                                    "Failed to delete duplicate event:",
                                    deleteError
                                );
                            }
                        }
                    }
                }
            } catch (error: any) {
                console.warn(
                    "Error in post-creation duplicate check:",
                    error?.message || error
                );
                // Continue if check fails
            }

            // Track the mapping using the stable identifier
            const finalEventId = createdEventId || null;
            if (finalEventId) {
                this.syncState.eventMapping[eventKey] = finalEventId;
            }
            return finalEventId;
        }
    }

    /**
     * Find an event in Google Calendar by title and date
     * Returns the Google Calendar event ID if found
     */
    async findEventByTitleAndDate(
        title: string,
        dateStr: string
    ): Promise<string | null> {
        if (!this.isAuthenticated()) {
            return null;
        }

        try {
            await this.refreshTokenIfNeeded();

            // Parse the date string (YYYY-MM-DD)
            const date = new Date(dateStr + "T00:00:00Z");
            const startOfDay = new Date(date);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setUTCHours(23, 59, 59, 999);

            const response = await this.calendar.events.list({
                calendarId: this.calendarId,
                timeMin: startOfDay.toISOString(),
                timeMax: endOfDay.toISOString(),
                q: title, // Search by title
                maxResults: 10,
                singleEvents: true,
                orderBy: "startTime",
            });

            const events = response.data.items || [];
            // Find exact or close match
            const match = events.find(
                (item: any) =>
                    item.summary === title ||
                    item.summary?.includes(title) ||
                    title.includes(item.summary || "")
            );

            return match?.id || null;
        } catch (error: any) {
            console.error("Error finding event in Google Calendar:", error);
            return null;
        }
    }

    /**
     * Delete an event from Google Calendar by its Google Calendar ID
     */
    async deleteEventByGoogleId(googleEventId: string): Promise<void> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        try {
            await this.refreshTokenIfNeeded();

            await this.calendar.events.delete({
                calendarId: this.calendarId,
                eventId: googleEventId,
            });

            // Remove from mapping if it exists
            const mappingKey = Object.keys(this.syncState.eventMapping).find(
                (key) => this.syncState.eventMapping[key] === googleEventId
            );
            if (mappingKey) {
                delete this.syncState.eventMapping[mappingKey];
            }
        } catch (error: any) {
            console.error("Error deleting event from Google Calendar:", error);
            if (error.code === 404) {
                // Event already deleted, just remove from mapping if it exists
                const mappingKey = Object.keys(
                    this.syncState.eventMapping
                ).find(
                    (key) => this.syncState.eventMapping[key] === googleEventId
                );
                if (mappingKey) {
                    delete this.syncState.eventMapping[mappingKey];
                }
            } else if (error.code === 401) {
                throw new Error(
                    "Google Calendar authentication expired. Please re-authenticate."
                );
            } else {
                throw error;
            }
        }
    }

    /**
     * Delete an event from Google Calendar
     */
    async deleteEvent(obsidianEventId: string): Promise<void> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        const googleEventId = this.syncState.eventMapping[obsidianEventId];
        if (!googleEventId) {
            // Try to find a matching key (case-insensitive or partial match)
            const matchingKey = Object.keys(this.syncState.eventMapping).find(
                (key) =>
                    key === obsidianEventId ||
                    key.toLowerCase() === obsidianEventId.toLowerCase() ||
                    key.endsWith(obsidianEventId) ||
                    obsidianEventId.endsWith(key)
            );

            if (matchingKey) {
                const matchedGoogleId =
                    this.syncState.eventMapping[matchingKey];
                await this.calendar.events.delete({
                    calendarId: this.calendarId,
                    eventId: matchedGoogleId,
                });
                delete this.syncState.eventMapping[matchingKey];
                return;
            }

            // If not found in mapping, check if it's in pending deletions
            if (this.syncState.pendingDeletions?.includes(obsidianEventId)) {
                // Already in pending, will be processed during sync
                return;
            }

            // Add to pending deletions for later sync
            this.addPendingDeletion(obsidianEventId);
            throw new Error(
                `No Google Calendar event found for: ${obsidianEventId}`
            );
        }

        try {
            await this.refreshTokenIfNeeded();

            await this.calendar.events.delete({
                calendarId: this.calendarId,
                eventId: googleEventId,
            });

            delete this.syncState.eventMapping[obsidianEventId];
            // Remove from pending deletions if it was there
            if (this.syncState.pendingDeletions) {
                const pendingIndex =
                    this.syncState.pendingDeletions.indexOf(obsidianEventId);
                if (pendingIndex > -1) {
                    this.syncState.pendingDeletions.splice(pendingIndex, 1);
                }
            }
        } catch (error: any) {
            if (error.code === 404) {
                // Event already deleted, just remove from mapping and pending
                delete this.syncState.eventMapping[obsidianEventId];
                if (this.syncState.pendingDeletions) {
                    const pendingIndex =
                        this.syncState.pendingDeletions.indexOf(
                            obsidianEventId
                        );
                    if (pendingIndex > -1) {
                        this.syncState.pendingDeletions.splice(pendingIndex, 1);
                    }
                }
            } else if (error.code === 401) {
                throw new Error(
                    "Google Calendar authentication expired. Please re-authenticate."
                );
            } else {
                // Network error or other issue - add to pending deletions
                console.error(
                    "Error deleting event from Google Calendar:",
                    error
                );
                this.addPendingDeletion(obsidianEventId);
                throw error;
            }
        }
    }

    /**
     * Sync multiple events to Google Calendar
     */
    async syncEvents(events: OFCEvent[]): Promise<void> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        const results = {
            synced: 0,
            skipped: 0,
            failed: 0,
        };

        for (const event of events) {
            try {
                const googleId = await this.syncEvent(event, undefined);
                if (googleId) {
                    results.synced++;
                } else {
                    results.skipped++;
                }
            } catch (error) {
                console.error("Failed to sync event:", event.title, error);
                results.failed++;
            }
        }

        this.syncState.lastSyncTime = Date.now();

        new Notice(
            `Google Calendar sync: ${results.synced} synced, ${results.skipped} skipped, ${results.failed} failed`
        );
    }

    /**
     * Process pending deletions from Google Calendar
     */
    private async processPendingDeletions(): Promise<{
        deleted: number;
        failed: number;
    }> {
        const results = {
            deleted: 0,
            failed: 0,
        };

        if (
            !this.syncState.pendingDeletions ||
            this.syncState.pendingDeletions.length === 0
        ) {
            return results;
        }

        // Process deletions in batches with delays to avoid rate limits
        const BATCH_SIZE = 5; // Reduced from 10 to avoid rate limits
        const BATCH_DELAY_MS = 1000; // 1 second between batches
        const REQUEST_DELAY_MS = 200; // Delay between individual requests
        const deletionsToProcess = [...this.syncState.pendingDeletions];
        const remainingDeletions: string[] = [];

        for (let i = 0; i < deletionsToProcess.length; i += BATCH_SIZE) {
            const batch = deletionsToProcess.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.allSettled(
                batch.map(async (eventKey, index) => {
                    // Add delay between requests within the batch
                    if (index > 0) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, REQUEST_DELAY_MS)
                        );
                    }
                    return this.deleteEvent(eventKey);
                })
            );

            for (let j = 0; j < batchResults.length; j++) {
                const result = batchResults[j];
                const eventKey = batch[j];

                if (result.status === "fulfilled") {
                    results.deleted++;
                    // Remove from mapping if it exists
                    if (this.syncState.eventMapping[eventKey]) {
                        delete this.syncState.eventMapping[eventKey];
                    }
                } else {
                    console.warn(
                        `Failed to delete pending event ${eventKey}:`,
                        result.reason
                    );
                    results.failed++;
                    // Keep in pending list to retry later
                    remainingDeletions.push(eventKey);
                }
            }

            // Small delay between batches
            if (i + BATCH_SIZE < deletionsToProcess.length) {
                await new Promise((resolve) =>
                    setTimeout(resolve, BATCH_DELAY_MS)
                );
            }
        }

        // Update pending deletions list (keep only failed ones)
        this.syncState.pendingDeletions = remainingDeletions;

        return results;
    }

    /**
     * Add an event key to pending deletions (for offline deletion tracking)
     */
    addPendingDeletion(eventKey: string): void {
        if (!this.syncState.pendingDeletions) {
            this.syncState.pendingDeletions = [];
        }
        if (!this.syncState.pendingDeletions.includes(eventKey)) {
            this.syncState.pendingDeletions.push(eventKey);
        }
    }

    /**
     * Delete Google Calendar events that no longer exist in Obsidian
     * Only deletes events that are in our mapping (i.e., events we created)
     */
    private async deleteOrphanedEvents(
        obsidianEventKeys: Set<string>
    ): Promise<number> {
        let deletedCount = 0;
        const eventsToDelete: Array<{ obsidianKey: string; googleId: string }> =
            [];

        // Find events in mapping that don't exist in Obsidian
        for (const [obsidianKey, googleId] of Object.entries(
            this.syncState.eventMapping
        )) {
            if (!obsidianEventKeys.has(obsidianKey)) {
                eventsToDelete.push({ obsidianKey, googleId });
            }
        }

        if (eventsToDelete.length === 0) {
            return 0;
        }

        // Delete in batches with delays to avoid rate limits
        const BATCH_SIZE = 5; // Reduced from 10
        const BATCH_DELAY_MS = 1000; // 1 second between batches
        const REQUEST_DELAY_MS = 200; // Delay between individual requests
        for (let i = 0; i < eventsToDelete.length; i += BATCH_SIZE) {
            const batch = eventsToDelete.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.allSettled(
                batch.map(async ({ googleId, obsidianKey }, index) => {
                    // Add delay between requests within the batch
                    if (index > 0) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, REQUEST_DELAY_MS)
                        );
                    }
                    return this.calendar.events
                        .delete({
                            calendarId: this.calendarId,
                            eventId: googleId,
                        })
                        .then(() => {
                            // Remove from mapping on success
                            delete this.syncState.eventMapping[obsidianKey];
                            return obsidianKey;
                        });
                })
            );

            for (let j = 0; j < batchResults.length; j++) {
                const result = batchResults[j];
                const { obsidianKey, googleId } = batch[j];

                if (result.status === "fulfilled") {
                    deletedCount++;
                    // Remove from mapping on success
                    delete this.syncState.eventMapping[obsidianKey];
                } else {
                    const error = result.reason as any;
                    // Handle 410 (Gone) errors gracefully - event already deleted
                    if (
                        error?.code === 410 ||
                        error?.response?.status === 410
                    ) {
                        deletedCount++;
                        // Remove from mapping since event is already gone
                        delete this.syncState.eventMapping[obsidianKey];
                    } else {
                        console.warn("Failed to delete orphaned event:", error);
                        // If deletion fails for other reasons, keep it in mapping for retry
                    }
                }
            }

            // Delay between batches to avoid rate limits
            if (i + BATCH_SIZE < eventsToDelete.length) {
                await new Promise((resolve) =>
                    setTimeout(resolve, BATCH_DELAY_MS)
                );
            }
        }

        return deletedCount;
    }

    /**
     * Sync multiple events with file paths for stable identification
     * Processes events in parallel batches for better performance
     * @param showNotice Whether to show a notice when sync completes (default: false)
     */
    async syncEventsWithPaths(
        eventsWithPaths: Array<{ event: OFCEvent; filePath?: string }>,
        showNotice: boolean = false
    ): Promise<{
        synced: number;
        skipped: number;
        failed: number;
        deleted: number;
    }> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        // Refresh token once before parallel processing
        await this.refreshTokenIfNeeded();

        // Process pending deletions first
        const deletionResults = await this.processPendingDeletions();

        const results = {
            synced: 0,
            skipped: 0,
            failed: 0,
            deleted: 0,
        };

        // Process events in parallel batches to respect API rate limits
        // Google Calendar API allows ~100 requests per 100 seconds per user
        // We'll use smaller batches with longer delays to avoid rate limits
        const BATCH_SIZE = 5; // Reduced from 10 to avoid rate limits
        const BATCH_DELAY_MS = 1000; // Increased from 100ms to 1 second between batches
        const REQUEST_DELAY_MS = 200; // Delay between individual requests within a batch

        // Deduplicate events by their keys AND by title+date to prevent syncing the same event multiple times
        // This handles cases where the same event might have different keys (e.g., one with event.id, one with filePath)
        const eventMap = new Map<
            string,
            { event: OFCEvent; filePath?: string }
        >();
        const titleDateMap = new Map<string, string>(); // Maps "title|date" to eventKey

        for (const { event, filePath } of eventsWithPaths) {
            // Use filePath as primary key, event.id as fallback (same priority as in syncEvent)
            const eventKey = filePath || event.id;
            if (!eventKey) {
                // If no key, try to deduplicate by title and date
                const titleDateKey = this.getTitleDateKey(event);
                if (titleDateKey) {
                    const existingKey = titleDateMap.get(titleDateKey);
                    if (existingKey && eventMap.has(existingKey)) {
                        // Event with same title/date already exists, skip this one
                        continue;
                    }
                }
                // No way to deduplicate, include it
                const fallbackKey = `no-key-${Math.random()}`;
                eventMap.set(fallbackKey, { event, filePath });
                if (titleDateKey) {
                    titleDateMap.set(titleDateKey, fallbackKey);
                }
                continue;
            }

            // Check if we already have this event by key
            const existing = eventMap.get(eventKey);
            if (existing) {
                // Event with same key already exists, keep the one with the most complete information
                if (!existing.filePath && filePath) {
                    eventMap.set(eventKey, { event, filePath });
                }
                continue;
            }

            // Check if we have an event with the same title and date but different key
            const titleDateKey = this.getTitleDateKey(event);
            if (titleDateKey) {
                const existingKey = titleDateMap.get(titleDateKey);
                if (
                    existingKey &&
                    existingKey !== eventKey &&
                    eventMap.has(existingKey)
                ) {
                    // Event with same title/date already exists with different key, skip this one
                    continue;
                }
                titleDateMap.set(titleDateKey, eventKey);
            }

            eventMap.set(eventKey, { event, filePath });
        }

        // Convert back to array, now deduplicated
        const deduplicatedEvents = Array.from(eventMap.values());

        // Track which Obsidian events exist (by their keys) for orphaned deletion
        // Use same key priority as syncEvent: filePath > event.id
        const obsidianEventKeys = new Set<string>();
        for (const { event, filePath } of deduplicatedEvents) {
            const eventKey = filePath || event.id;
            if (eventKey) {
                obsidianEventKeys.add(eventKey);
            }
            // Also add event.id if it exists and is different from filePath
            // This ensures we don't delete events that were mapped by event.id
            if (event.id && event.id !== eventKey) {
                obsidianEventKeys.add(event.id);
            }
        }

        for (let i = 0; i < deduplicatedEvents.length; i += BATCH_SIZE) {
            const batch = deduplicatedEvents.slice(i, i + BATCH_SIZE);

            // Process batch with delays between requests to avoid rate limits
            const batchResults = await Promise.allSettled(
                batch.map(async ({ event, filePath }, index) => {
                    // Add delay between requests within the batch
                    if (index > 0) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, REQUEST_DELAY_MS)
                        );
                    }
                    return this.syncEvent(event, filePath);
                })
            );

            // Count results
            for (const result of batchResults) {
                if (result.status === "fulfilled") {
                    if (result.value) {
                        results.synced++;
                    } else {
                        results.skipped++;
                    }
                } else {
                    console.error("Failed to sync event:", result.reason);
                    results.failed++;
                }
            }

            // Small delay between batches to avoid hitting rate limits
            if (i + BATCH_SIZE < deduplicatedEvents.length) {
                await new Promise((resolve) =>
                    setTimeout(resolve, BATCH_DELAY_MS)
                );
            }
        }

        // Delete Google Calendar events that no longer exist in Obsidian
        const deletedCount = await this.deleteOrphanedEvents(obsidianEventKeys);
        results.deleted = deletedCount;

        this.syncState.lastSyncTime = Date.now();

        // Only show notice if explicitly requested (for periodic sync)
        if (showNotice) {
            const noticeParts = [
                `${results.synced} synced`,
                results.skipped > 0 ? `${results.skipped} skipped` : null,
                results.failed > 0 ? `${results.failed} failed` : null,
                results.deleted > 0 ? `${results.deleted} deleted` : null,
            ].filter((part) => part !== null);

            new Notice(`Google Calendar sync: ${noticeParts.join(", ")}`);
        }

        return results;
    }

    /**
     * Get current sync state
     */
    getSyncState(): SyncState {
        return this.syncState;
    }

    /**
     * Load sync state from storage
     */
    loadSyncState(state: SyncState): void {
        const mapping = state.eventMapping || {};
        // Deep copy to avoid reference issues
        this.syncState = {
            lastSyncTime: state.lastSyncTime || 0,
            eventMapping: { ...mapping }, // Create a new object to avoid reference issues
            pendingDeletions: state.pendingDeletions
                ? [...state.pendingDeletions]
                : [],
        };
    }

    /**
     * Get current credentials
     */
    getCredentials(): {
        accessToken?: string;
        refreshToken?: string;
        tokenExpiry?: number;
    } {
        const creds = this.oauth2Client.credentials;
        return {
            accessToken: creds.access_token || undefined,
            refreshToken: creds.refresh_token || undefined,
            tokenExpiry: creds.expiry_date || undefined,
        };
    }
}
