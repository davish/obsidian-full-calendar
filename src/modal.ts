import { Calendar, EventApi } from "@fullcalendar/core";
import FullCalendarPlugin from "./main";
import { App, Modal, Notice, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { EditEvent } from "./components/EditEvent";
import { AddCalendarSource } from "./components/AddCalendarSource";
import { EventFrontmatter } from "./types";
import { CalendarEvent, EditableEvent, LocalEvent } from "./models/Event";
import { NoteEvent } from "./models/NoteEvent";
import { eventFromCalendarId } from "./models";

export class EventModal extends Modal {
	plugin: FullCalendarPlugin;
	calendar: Calendar | null;

	data: Partial<EventFrontmatter> | undefined;
	event: CalendarEvent | undefined;
	file: TFile | undefined;

	constructor(
		app: App,
		plugin: FullCalendarPlugin,
		calendar: Calendar | null,
		title: string,
		event?: Partial<EventFrontmatter>
	) {
		super(app);
		this.plugin = plugin;
		this.data = event;
		this.calendar = calendar;
		this.titleEl.setText(title);
	}

	async editInModal(input: EventApi | TFile) {
		let frontmatter = null;
		if (input instanceof EventApi) {
			const event = await eventFromCalendarId(
				this.app.metadataCache,
				this.app.vault,
				input.id
			);
			if (event) {
				this.data = event.data;
				this.event = event;
				this.open();
			} else {
				new Notice(
					"Full Calendar: No frontmatter to edit for selected event."
				);
				console.warn(
					"Full Calendar: No frontmatter to edit for selected event."
				);
			}
		} else if (input instanceof TFile) {
			const e = NoteEvent.fromFile(
				this.app.metadataCache,
				this.app.vault,
				input
			);
			frontmatter = e?.data;
			this.file = input;
			this.data = frontmatter || { title: input.basename };
			this.event = e || undefined;
			this.open();
		}
	}

	async onOpen() {
		const { contentEl } = this;
		await this.plugin.loadSettings();

		ReactDOM.render(
			React.createElement(EditEvent, {
				initialEvent: this.data,
				submit: async (data, calendarIndex) => {
					const source = this.plugin.settings.calendarSources.filter(
						(s) => s.type === "local"
					)[calendarIndex];
					if (source.type !== "local") {
						new Notice(
							"Sorry, remote sync is currently read-only."
						);
						this.close();
						return;
					}
					const directory = source.directory;
					try {
						if (this.file && !this.event) {
							NoteEvent.upgrade(
								this.app.metadataCache,
								this.app.vault,
								this.file,
								data
							);
						} else if (!this.event) {
							NoteEvent.create(
								this.app.metadataCache,
								this.app.vault,
								directory,
								data
							);
						} else {
							if (this.event instanceof EditableEvent) {
								await this.event.setData(data);
								if (this.event instanceof NoteEvent) {
									await this.event.setDirectory(directory);
								}
							}
						}
					} catch (e: any) {
						new Notice(e.message);
					} finally {
						this.close();
					}
				},
				defaultCalendarIndex: this.plugin.settings.defaultCalendar,
				calendars: this.plugin.settings.calendarSources,
				open:
					this.event instanceof LocalEvent
						? async () => {
								if (this.event instanceof LocalEvent) {
									let leaf =
										this.app.workspace.getMostRecentLeaf();
									await this.event.openIn(leaf);
									this.close();
								}
						  }
						: undefined,
				deleteEvent:
					this.event instanceof LocalEvent
						? async () => {
								if (this.event instanceof LocalEvent) {
									await this.event.delete();
									this.close();
								}
						  }
						: undefined,
			}),
			contentEl
		);
	}

	onClose() {
		const { contentEl } = this;
		ReactDOM.unmountComponentAtNode(contentEl);
	}
}

export class ReactModal<Props, Component> extends Modal {
	onOpenCallback: () => Promise<ReturnType<typeof React.createElement>>;

	constructor(
		app: App,
		onOpenCallback: () => Promise<ReturnType<typeof React.createElement>>
	) {
		super(app);
		this.onOpenCallback = onOpenCallback;
	}

	async onOpen() {
		const { contentEl } = this;
		ReactDOM.render(await this.onOpenCallback(), contentEl);
	}

	onClose() {
		const { contentEl } = this;
		ReactDOM.unmountComponentAtNode(contentEl);
	}
}
