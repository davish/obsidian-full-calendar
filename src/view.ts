import "./overrides.css";
import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { Calendar } from "@fullcalendar/core";
import { renderCalendar } from "./calendar";
import FullCalendarPlugin from "./main";
import { EventModal } from "./modal";
import { FCError, PLUGIN_SLUG } from "./types";
import {
	dateEndpointsToFrontmatter,
	eventApiToFrontmatter,
} from "./frontmatter";
import { IcsSource } from "./models/IcsSource";
import { NoteSource } from "./models/NoteSource";
import { RemoteSource } from "./models/RemoteSource";
import { renderOnboarding } from "./onboard";
import { CalendarEvent, LocalEvent } from "./models/Event";
import { NoteEvent } from "./models/NoteEvent";
import { eventFromCalendarId } from "./models";

export const FULL_CALENDAR_VIEW_TYPE = "full-calendar-view";

export class CalendarView extends ItemView {
	calendar: Calendar | null;
	plugin: FullCalendarPlugin;
	cacheCallback: (file: TFile) => void;
	constructor(leaf: WorkspaceLeaf, plugin: FullCalendarPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.calendar = null;
		this.cacheCallback = this.onCacheUpdate.bind(this);
	}

	getViewType() {
		return FULL_CALENDAR_VIEW_TYPE;
	}

	getDisplayText() {
		return "Calendar";
	}

	onCacheUpdate(file: TFile) {
		const source = this.plugin.settings.calendarSources.find(
			(c) => c.type === "local" && file.path.startsWith(c.directory)
		);
		const event = NoteEvent.fromFile(
			this.app.metadataCache,
			this.app.vault,
			file
		);
		if (!event) {
			return;
		}
		// Serialize ID correctly from file.
		let calendarEvent = this.calendar?.getEventById(event.idForCalendar);
		if (this.calendar && source && event) {
			if (calendarEvent) {
				calendarEvent.remove();
			}
			// TODO: Respect recursion settings when adding event to the calendar.
			event.addTo(this.calendar, source);
		}
	}

	async onOpen() {
		await this.plugin.loadSettings();
		const noteSourcePromises = this.plugin.settings.calendarSources
			.flatMap((s) => (s.type === "local" ? [s] : []))
			.map((s) =>
				new NoteSource(this.app.vault, this.app.metadataCache, s).toApi(
					this.plugin.settings.recursiveLocal
				)
			);
		const container = this.containerEl.children[1];
		container.empty();
		let calendarEl = container.createEl("div");
		const noteSourceResults = await Promise.all(noteSourcePromises);
		const sources = noteSourceResults.flatMap((s) =>
			s instanceof FCError ? [] : [s]
		);
		if (
			sources.length === 0 &&
			this.plugin.settings.calendarSources.filter(
				(s) =>
					s.type === "ical" ||
					s.type === "caldav" ||
					s.type === "icloud"
			).length === 0
		) {
			renderOnboarding(this.app, this.plugin, calendarEl);
			return;
		}

		let errs = noteSourceResults.flatMap((s) =>
			s instanceof FCError ? [s] : []
		);
		for (const err of errs) {
			new Notice(err.message);
		}

		this.calendar = renderCalendar(calendarEl, sources, {
			eventClick: async (info) => {
				if (
					info.jsEvent.getModifierState("Control") ||
					info.jsEvent.getModifierState("Meta")
				) {
					let file = this.app.vault.getAbstractFileByPath(
						info.event.id
					);
					if (file instanceof TFile) {
						let leaf = this.app.workspace.getMostRecentLeaf();
						await leaf.openFile(file);
					}
				} else {
					new EventModal(
						this.app,
						this.plugin,
						this.calendar
					).editInModal(info.event);
				}
			},
			select: async (start, end, allDay) => {
				const partialEvent = dateEndpointsToFrontmatter(
					start,
					end,
					allDay
				);
				let modal = new EventModal(
					this.app,
					this.plugin,
					this.calendar,
					partialEvent
				);
				modal.open();
			},
			modifyEvent: async (newEvent, oldEvent) => {
				try {
					const existingEvent = await eventFromCalendarId(
						this.app.metadataCache,
						this.app.vault,
						oldEvent.id
					);
					if (!existingEvent) {
						return false;
					}
					const frontmatter = eventApiToFrontmatter(newEvent);
					await existingEvent.setData(frontmatter);
				} catch (e: any) {
					new Notice(e.message);
					return false;
				}
				return true;
			},

			eventMouseEnter: async (info) => {
				const event = await eventFromCalendarId(
					this.app.metadataCache,
					this.app.vault,
					info.event.id
				);
				if (event instanceof LocalEvent) {
					this.app.workspace.trigger("hover-link", {
						event: info.jsEvent,
						source: PLUGIN_SLUG,
						hoverParent: calendarEl,
						targetEl: info.jsEvent.target,
						linktext: event.path,
						sourcePath: event.path,
					});
				}
			},
			firstDay: this.plugin.settings.firstDay,
		});

		this.plugin.settings.calendarSources
			.flatMap((s) => (s.type === "ical" ? [s] : []))
			.map((s) => new IcsSource(s))
			.map((s) => s.toApi())
			.forEach((resultPromise) =>
				resultPromise.then((result) => {
					if (result instanceof FCError) {
						new Notice(result.message);
					} else {
						this.calendar?.addEventSource(result);
					}
				})
			);

		this.plugin.settings.calendarSources
			.flatMap((s) =>
				s.type === "caldav" || s.type === "icloud" ? [s] : []
			)
			.map((s) => new RemoteSource(s))
			.map((s) => s.toApi())
			.forEach((resultPromise) =>
				resultPromise.then((result) => {
					if (result instanceof FCError) {
						new Notice(result.message);
					} else {
						this.calendar?.addEventSource(result);
					}
				})
			);

		this.registerEvent(
			this.app.metadataCache.on("changed", this.cacheCallback)
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					// TODO: This is a HACK. Think of a way to make this generic for all types of local events.
					let id =
						NoteEvent.ID_PREFIX +
						CalendarEvent.ID_SEPARATOR +
						file.path;
					const event = this.calendar?.getEventById(id);
					if (event) {
						event.remove();
					}
				}
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				// TODO: This is a HACK. Think of a way to make this generic for all types of local events.
				const oldEvent = this.calendar?.getEventById(
					NoteEvent.ID_PREFIX + CalendarEvent.ID_SEPARATOR + oldPath
				);
				if (oldEvent) {
					oldEvent.remove();
				}
				// Rename doesn't change any of the metadata so we also need to trigger
				// that same callback.
				if (file instanceof TFile) {
					this.onCacheUpdate(file);
				}
			})
		);
	}

	onResize(): void {
		if (this.calendar) {
			this.calendar.render();
		}
	}

	async onClose() {
		if (this.calendar) {
			this.calendar.destroy();
			this.calendar = null;
		}
	}
}
