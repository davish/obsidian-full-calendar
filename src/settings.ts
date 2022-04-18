import FullCalendarPlugin from "./main";
import {
	App,
	DropdownComponent,
	Notice,
	PluginSettingTab,
	Setting,
	TFolder,
} from "obsidian";
import {
	isCalDAV,
	makeDefaultPartialCalendarSource,
	CalendarSource,
	FCError,
} from "./types";
import { CalendarSettings } from "./components/CalendarSetting";
import { AddCalendarSource } from "./components/AddCalendarSource";
import { RemoteSource } from "./models/EventSource";
import * as ReactDOM from "react-dom";
import { createElement } from "react";
import { ReactModal } from "./modal";

export interface FullCalendarSettings {
	calendarSources: CalendarSource[];
	defaultCalendar: number;
	recursiveLocal: boolean;
	firstDay: number;
}

export const DEFAULT_SETTINGS: FullCalendarSettings = {
	calendarSources: [],
	defaultCalendar: 0,
	recursiveLocal: false,
	firstDay: 0,
};

const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

export function addCalendarButton(
	app: App,
	plugin: FullCalendarPlugin,
	containerEl: HTMLElement,
	submitCallback: (setting: CalendarSource) => void,
	listUsedDirectories?: () => string[]
) {
	let dropdown: DropdownComponent;
	const directories = app.vault
		.getAllLoadedFiles()
		.filter((f) => f instanceof TFolder)
		.map((f) => f.path);

	return new Setting(containerEl)
		.setName("Calendars")
		.setDesc("Add calendar")
		.addDropdown(
			(d) =>
				(dropdown = d.addOptions({
					local: "Local",
					icloud: "iCloud",
					caldav: "CalDAV",
					ical: "Remote (.ics format)",
				}))
		)
		.addExtraButton((button) => {
			button.setTooltip("Add Calendar");
			button.setIcon("plus-with-circle");
			button.onClick(() => {
				let modal = new ReactModal(app, async () => {
					await plugin.loadSettings();
					const usedDirectories = (
						listUsedDirectories
							? listUsedDirectories
							: () =>
									plugin.settings.calendarSources
										.map(
											(s) =>
												s.type === "local" &&
												s.directory
										)
										.filter((s): s is string => !!s)
					)();

					return createElement(AddCalendarSource, {
						source: makeDefaultPartialCalendarSource(
							dropdown.getValue() as CalendarSource["type"]
						),
						directories: directories.filter(
							(dir) => usedDirectories.indexOf(dir) === -1
						),
						submit: async (source: CalendarSource) => {
							if (
								source.type === "caldav" ||
								source.type === "icloud"
							) {
								let sources = await new RemoteSource(
									app.vault,
									app.metadataCache,
									source
								).importCalendars();
								if (sources instanceof FCError) {
									new Notice(sources.message);
								} else {
									sources.forEach((source) =>
										submitCallback(source)
									);
								}
							} else {
								submitCallback(source);
							}
							modal.close();
						},
					});
				});
				modal.open();
			});
		});
}

export class FullCalendarSettingTab extends PluginSettingTab {
	plugin: FullCalendarPlugin;
	sourceList?: CalendarSettings;

	constructor(app: App, plugin: FullCalendarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Events settings" });

		new Setting(containerEl)
			.setName("Recursive event folders")
			.setDesc("Search through sub-folders for events")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.recursiveLocal);
				toggle.onChange(async (val) => {
					this.plugin.settings.recursiveLocal = val;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Starting Day of the Week")
			.setDesc("Choose what day of the week to start.")
			.addDropdown((dropdown) => {
				WEEKDAYS.forEach((day, code) => {
					dropdown.addOption(code.toString(), day);
				});
				dropdown.setValue(this.plugin.settings.firstDay.toString());
				dropdown.onChange(async (codeAsString) => {
					this.plugin.settings.firstDay = Number(codeAsString);
					await this.plugin.saveSettings();
				});
			});

		addCalendarButton(
			this.app,
			this.plugin,
			containerEl,
			async (source: CalendarSource) => {
				sourceList.addSource(source);
			},
			() =>
				sourceList.state.sources
					.map((s) => s.type === "local" && s.directory)
					.filter((s): s is string => !!s)
		);

		const sourcesDiv = containerEl.createDiv();
		sourcesDiv.style.display = "block";
		let sourceList = ReactDOM.render(
			createElement(CalendarSettings, {
				sources: this.plugin.settings.calendarSources,
				submit: async (sources: CalendarSource[]) => {
					await this.handleRemoval(
						this.plugin.settings.calendarSources,
						sources
					);

					this.plugin.settings.calendarSources = sources;
					await this.plugin.saveSettings();
				},
				sourcesUpdated: async (
					oldSources: CalendarSource[],
					sources: CalendarSource[]
				) => {
					await this.handleRemoval(oldSources, sources, true);
				},
			}),
			sourcesDiv
		);
		this.sourceList = sourceList;
	}

	async handleRemoval(
		oldSources: CalendarSource[],
		sources: CalendarSource[],
		checkExisting: boolean = false
	) {
		// Handle removed sources
		let removalPromises: Promise<void>[] = [];
		oldSources.forEach((oldSource) => {
			if (!isCalDAV(oldSource)) {
				return;
			}

			let remove = false;
			let newlyFound = sources.find(
				(newSource) =>
					isCalDAV(newSource) && newSource.url == oldSource.url
			);
			if (newlyFound == undefined) {
				if (checkExisting) {
					// Only remove if the source is a saved source. That means
					// we added a source, and subsequently removed it without
					// ever saving it. This is the only opportunity to clean up
					// any caches associated with CalDAV calendars that were
					// imported but never saved.
					let existing = this.plugin.settings.calendarSources.find(
						(existingSource) =>
							isCalDAV(existingSource) &&
							existingSource.url == oldSource.url
					);
					remove = existing == undefined;
				} else {
					remove = true;
				}
			}
			if (remove) {
				removalPromises.push(
					new RemoteSource(
						this.app.vault,
						this.app.metadataCache,
						oldSource
					).emptyCache()
				);
			}
		});
		await Promise.all(removalPromises);
	}

	async hide() {
		if (!this.sourceList) {
			return;
		}

		if (this.sourceList.state.dirty) {
			await this.handleRemoval(
				this.sourceList.state.sources,
				this.plugin.settings.calendarSources
			);
		}
	}
}
