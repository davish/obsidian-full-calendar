import { App, Notice, Modal, Setting, TextComponent } from "obsidian";
import * as React from "react";
import { SetStateAction, useState } from "react";

import { CalendarInfo } from "../../types";
import FullCalendarPlugin from "../../main";

/**
 * Modal for entering Google OAuth authorization code
 */
class AuthCodeModal extends Modal {
    onSubmit: (code: string) => void;
    onCancel: () => void;

    constructor(
        app: App,
        onSubmit: (code: string) => void,
        onCancel: () => void
    ) {
        super(app);
        this.onSubmit = onSubmit;
        this.onCancel = onCancel;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Enter Authorization Code" });

        const instructions = contentEl.createDiv();
        instructions.innerHTML = `
            <p><strong>After completing authentication in the browser:</strong></p>
            <ol>
                <li>Google will redirect to <code>http://localhost</code> (you'll see "This site can't be reached" - that's normal)</li>
                <li>Look at the URL in your browser's address bar</li>
                <li>Copy the ENTIRE <code>code</code> value (the part after <code>code=</code>)</li>
                <li>Example: If URL is <code>http://localhost/?code=4/0Ab32j92...</code>, copy <code>4/0Ab32j92...</code></li>
            </ol>
        `;

        let codeInput: TextComponent;
        new Setting(contentEl)
            .setName("Authorization Code")
            .setDesc("Paste the code from the browser URL here")
            .addText((text) => {
                codeInput = text;
                text.setPlaceholder("4/0Ab32j92...");
                text.inputEl.style.width = "100%";
                text.inputEl.focus();
            });

        new Setting(contentEl).addButton((button) => {
            button
                .setButtonText("Authenticate")
                .setCta()
                .onClick(() => {
                    const code = codeInput.getValue().trim();
                    if (code) {
                        this.onSubmit(code);
                        this.close();
                    } else {
                        new Notice("Please enter the authorization code");
                    }
                });
        });

        new Setting(contentEl).addButton((button) => {
            button.setButtonText("Cancel").onClick(() => {
                this.onCancel();
                this.close();
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

type SourceWith<T extends Partial<CalendarInfo>, K> = T extends K ? T : never;

interface BasicProps<T extends Partial<CalendarInfo>> {
    source: T;
}

function DirectorySetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithDirectory = source as SourceWith<T, { directory: undefined }>;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithDirectory.directory}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function HeadingSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithHeading = source as SourceWith<T, { heading: undefined }>;
    return (
        <div
            className="setting-item-control"
            style={{ display: "block", textAlign: "center" }}
        >
            <span>Under heading</span>{" "}
            <input
                disabled
                type="text"
                value={sourceWithHeading.heading}
                style={{
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />{" "}
            <span style={{ paddingRight: ".5rem" }}>in daily notes</span>
        </div>
    );
}

function UrlSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithUrl = source as SourceWith<T, { url: undefined }>;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithUrl.url}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function NameSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithName = source as SourceWith<T, { name: undefined }>;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithName.name}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function Username<T extends Partial<CalendarInfo>>({ source }: BasicProps<T>) {
    let sourceWithUsername = source as SourceWith<T, { username: undefined }>;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithUsername.username}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function CalendarIdSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithCalendarId = source as SourceWith<
        T,
        { calendarId: undefined }
    >;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithCalendarId.calendarId || ""}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function SyncStatusSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithSync = source as SourceWith<T, { syncEnabled: undefined }>;
    const isAuthenticated =
        sourceWithSync.type === "google" &&
        !!(sourceWithSync.accessToken || sourceWithSync.refreshToken);
    const syncEnabled = sourceWithSync.syncEnabled || false;

    return (
        <div className="setting-item-control">
            <span
                style={{
                    marginLeft: 4,
                    marginRight: 4,
                    fontSize: "0.9em",
                    color: isAuthenticated
                        ? "var(--text-success)"
                        : "var(--text-muted)",
                }}
            >
                {isAuthenticated
                    ? syncEnabled
                        ? "✓ Authenticated & Syncing"
                        : "✓ Authenticated (Sync Disabled)"
                    : "⚠ Not Authenticated"}
            </span>
        </div>
    );
}

interface ManualSyncButtonProps {
    source: Partial<CalendarInfo>;
    plugin?: FullCalendarPlugin;
}

function ManualSyncButton({ source, plugin }: ManualSyncButtonProps) {
    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleSync = async () => {
        if (!plugin || source.type !== "google" || !source.directory) {
            return;
        }

        const isAuthenticated = !!(source.accessToken || source.refreshToken);
        if (!isAuthenticated) {
            new Notice("Please authenticate with Google Calendar first.");
            return;
        }

        setIsSyncing(true);
        try {
            // Use sync scheduler to sync the specific calendar by directory
            if (!plugin.syncScheduler) {
                new Notice(
                    "Sync scheduler not available. Please reload Obsidian."
                );
                return;
            }

            await plugin.syncScheduler.syncCalendarByDirectory(
                source.directory
            );
            new Notice("Sync completed successfully!");
        } catch (error: any) {
            console.error("Manual sync failed:", error);
            new Notice(`Sync failed: ${error?.message || "Unknown error"}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const isAuthenticated =
        source.type === "google" &&
        !!(source.accessToken || source.refreshToken);

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="setting-item-control">
            <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                style={{
                    marginLeft: 4,
                    marginRight: 4,
                    padding: "4px 8px",
                    opacity: isSyncing ? 0.6 : 1,
                }}
            >
                {isSyncing ? "Syncing..." : "Sync Now"}
            </button>
        </div>
    );
}

interface CalendarSettingsProps {
    setting: Partial<CalendarInfo>;
    onColorChange: (s: string) => void;
    deleteCalendar: () => void;
    plugin?: FullCalendarPlugin;
    onAuthenticate?: () => void;
}

export const CalendarSettingRow = ({
    setting,
    onColorChange,
    deleteCalendar,
    plugin,
    onAuthenticate,
}: CalendarSettingsProps) => {
    const isCalDAV = setting.type === "caldav";
    const isGoogle = setting.type === "google";
    const isAuthenticated =
        isGoogle && !!(setting.accessToken || setting.refreshToken);

    return (
        <div className="setting-item">
            <button
                type="button"
                onClick={deleteCalendar}
                style={{ maxWidth: "15%" }}
            >
                ✕
            </button>
            {setting.type === "local" ? (
                <DirectorySetting source={setting} />
            ) : setting.type === "dailynote" ? (
                <HeadingSetting source={setting} />
            ) : setting.type === "google" ? (
                <DirectorySetting source={setting} />
            ) : (
                <UrlSetting source={setting} />
            )}
            {isGoogle && <CalendarIdSetting source={setting} />}
            {isGoogle && <SyncStatusSetting source={setting} />}
            {isGoogle && <ManualSyncButton source={setting} plugin={plugin} />}
            {isCalDAV && <NameSetting source={setting} />}
            {isCalDAV && <Username source={setting} />}
            {isGoogle && !isAuthenticated && onAuthenticate && (
                <div className="setting-item-control">
                    <button
                        type="button"
                        onClick={onAuthenticate}
                        style={{
                            marginLeft: 4,
                            marginRight: 4,
                            padding: "4px 8px",
                        }}
                    >
                        Authenticate with Google
                    </button>
                </div>
            )}
            <input
                style={{ maxWidth: "25%", minWidth: "3rem" }}
                type="color"
                value={setting.color}
                onChange={(e) => onColorChange(e.target.value)}
            />
        </div>
    );
};

interface CalendarSettingProps {
    sources: CalendarInfo[];
    submit: (payload: CalendarInfo[]) => void;
    plugin?: FullCalendarPlugin;
}
type CalendarSettingState = {
    sources: CalendarInfo[];
    dirty: boolean;
};
export class CalendarSettings extends React.Component<
    CalendarSettingProps,
    CalendarSettingState
> {
    constructor(props: CalendarSettingProps) {
        super(props);
        this.state = { sources: props.sources, dirty: false };
    }

    addSource(source: CalendarInfo) {
        this.setState((state, props) => ({
            sources: [...state.sources, source],
            dirty: true,
        }));
    }

    render() {
        return (
            <div style={{ width: "100%" }}>
                {this.state.sources.map((s, idx) => (
                    <CalendarSettingRow
                        key={idx}
                        setting={s}
                        plugin={this.props.plugin}
                        onColorChange={(color) =>
                            this.setState((state, props) => ({
                                sources: [
                                    ...state.sources.slice(0, idx),
                                    { ...state.sources[idx], color },
                                    ...state.sources.slice(idx + 1),
                                ],
                                dirty: true,
                            }))
                        }
                        deleteCalendar={() =>
                            this.setState((state, props) => ({
                                sources: [
                                    ...state.sources.slice(0, idx),
                                    ...state.sources.slice(idx + 1),
                                ],
                                dirty: true,
                            }))
                        }
                        onAuthenticate={async () => {
                            if (s.type !== "google" || !this.props.plugin) {
                                return;
                            }

                            const oauthConfig =
                                this.props.plugin.settings.googleOAuth;
                            if (
                                !oauthConfig ||
                                !oauthConfig.clientId ||
                                !oauthConfig.clientSecret
                            ) {
                                new Notice(
                                    "Please configure Google OAuth credentials in settings first."
                                );
                                return;
                            }

                            try {
                                // Import GoogleCalendar dynamically
                                const GoogleCalendar = (
                                    await import(
                                        "../../calendars/GoogleCalendar"
                                    )
                                ).default;
                                const ObsidianIO = (
                                    await import("../../ObsidianAdapter")
                                ).ObsidianIO;

                                // Create a temporary calendar instance for authentication
                                // This instance will be reused for both getting the auth URL and exchanging the code
                                const tempCalendar = new GoogleCalendar(
                                    new ObsidianIO(this.props.plugin.app),
                                    s.color,
                                    s.directory,
                                    s.calendarId || "primary",
                                    s.syncEnabled || false,
                                    oauthConfig,
                                    s.accessToken,
                                    s.refreshToken,
                                    s.tokenExpiry
                                );

                                // Store the calendar instance so we can reuse it
                                const calendarInstance = tempCalendar;
                                const authUrl = calendarInstance.getAuthUrl();

                                // Open in browser
                                window.open(authUrl, "_blank");

                                // Show instructions
                                new Notice(
                                    "Complete authentication in the browser, then return here to paste the code."
                                );

                                // Show modal for entering authorization code
                                const modal = new AuthCodeModal(
                                    this.props.plugin.app,
                                    async (code: string) => {
                                        try {
                                            // Use the same calendar instance to exchange the code
                                            // This ensures the OAuth2Client has the same redirect URI
                                            const tokens =
                                                await calendarInstance.authenticateWithCode(
                                                    code
                                                );

                                            // Update the calendar source with tokens
                                            const updatedSources = [
                                                ...this.state.sources.slice(
                                                    0,
                                                    idx
                                                ),
                                                {
                                                    ...this.state.sources[idx],
                                                    accessToken:
                                                        tokens.accessToken,
                                                    refreshToken:
                                                        tokens.refreshToken,
                                                    tokenExpiry:
                                                        tokens.tokenExpiry,
                                                },
                                                ...this.state.sources.slice(
                                                    idx + 1
                                                ),
                                            ];
                                            this.setState({
                                                sources: updatedSources,
                                                dirty: true,
                                            });
                                            this.props.submit(updatedSources);
                                            new Notice(
                                                "Successfully authenticated with Google Calendar!"
                                            );
                                        } catch (error) {
                                            console.error(
                                                "Authentication error:",
                                                error
                                            );
                                            const errorMessage =
                                                error instanceof Error
                                                    ? error.message
                                                    : String(error);
                                            new Notice(
                                                `Authentication failed: ${errorMessage}`,
                                                10000
                                            ); // Show for 10 seconds
                                            console.error(
                                                "Full error details:",
                                                error
                                            );
                                        }
                                    },
                                    () => {
                                        new Notice("Authentication cancelled.");
                                    }
                                );
                                modal.open();
                            } catch (error) {
                                console.error(
                                    "Error setting up authentication:",
                                    error
                                );
                                new Notice(
                                    `Failed to start authentication: ${
                                        error instanceof Error
                                            ? error.message
                                            : "Unknown error"
                                    }`
                                );
                            }
                        }}
                    />
                ))}
                <div className="setting-item-control">
                    {this.state.dirty && (
                        <button
                            onClick={() => {
                                if (
                                    this.state.sources.filter(
                                        (s) => s.type === "dailynote"
                                    ).length > 1
                                ) {
                                    new Notice(
                                        "Only one daily note calendar is allowed."
                                    );
                                    return;
                                }
                                this.props.submit(
                                    this.state.sources.map(
                                        (elt) => elt as CalendarInfo
                                    )
                                );
                                this.setState({ dirty: false });
                            }}
                            style={{
                                backgroundColor: this.state.dirty
                                    ? "var(--interactive-accent)"
                                    : undefined,
                                color: this.state.dirty
                                    ? "var(--text-on-accent)"
                                    : undefined,
                            }}
                        >
                            {this.state.dirty ? "Save" : "Settings Saved"}
                        </button>
                    )}
                </div>
            </div>
        );
    }
}
