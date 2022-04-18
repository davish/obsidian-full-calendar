import { MarkdownView, Plugin } from "obsidian";
import { CalendarView, FULL_CALENDAR_VIEW_TYPE } from "./view";
import { renderCalendar } from "./calendar";

import { EventModal } from "./modal";
import { parseFrontmatter } from "./frontmatter";
import {
	DEFAULT_SETTINGS,
	FullCalendarSettings,
	FullCalendarSettingTab,
} from "./settings";
import { PLUGIN_SLUG } from "./types";

export default class FullCalendarPlugin extends Plugin {
	settings: FullCalendarSettings = DEFAULT_SETTINGS;

	renderCalendar = renderCalendar;
	processFrontmatter = parseFrontmatter;

	async activateView() {
		this.app.workspace.detachLeavesOfType(FULL_CALENDAR_VIEW_TYPE);

		await this.app.workspace.getUnpinnedLeaf().setViewState({
			type: FULL_CALENDAR_VIEW_TYPE,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(FULL_CALENDAR_VIEW_TYPE)[0]
		);
	}
	async onload() {
		await this.loadSettings();

		this.registerView(
			FULL_CALENDAR_VIEW_TYPE,
			(leaf) => new CalendarView(leaf, this)
		);
		this.addRibbonIcon(
			"calendar-glyph",
			"Open Full Calendar",
			(_: MouseEvent) => {
				this.activateView();
			}
		);

		this.addSettingTab(new FullCalendarSettingTab(this.app, this));

		this.addCommand({
			id: "full-calendar-new-event",
			name: "New Event",
			callback: () => {
				new EventModal(this.app, this, null).open();
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
			id: "full-calendar-upgrade-note",
			name: "Upgrade note to event",
			callback: () => {
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					const file = view.file;
					new EventModal(this.app, this, null).editInModal(file);
				}
			},
		});

		(this.app.workspace as any).registerHoverLinkSource(PLUGIN_SLUG, {
			display: "Full Calendar",
			defaultMod: true,
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(FULL_CALENDAR_VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
