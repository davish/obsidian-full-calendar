import { Calendar, EventInput } from "@fullcalendar/core";
import { MetadataCache, Vault, WorkspaceLeaf } from "obsidian";
import { parseFrontmatter } from "src/frontmatter";
import { CalendarSource, EventFrontmatter, FCError } from "src/types";

export function basenameFromEvent(event: EventFrontmatter): string {
	switch (event.type) {
		case "single":
		case undefined:
			return `${event.date} ${event.title}`;
		case "recurring":
			return `(Every ${event.daysOfWeek.join(",")}) ${event.title})`;
	}
}

export const getPathPrefix = (path: string): string =>
	path.split("/").slice(0, -1).join("/");

/**
 * Model class representing an event in the calendar.
 */
export abstract class CalendarEvent {
	static ID_SEPARATOR = "::";
	cache: MetadataCache;
	vault: Vault;

	protected _data: EventFrontmatter;

	// Each event stores a reference to the metadata cache and the vault so it can perform operations if necessary.
	constructor(cache: MetadataCache, vault: Vault, data: EventFrontmatter) {
		this.cache = cache;
		this.vault = vault;
		this._data = data;
	}

	/**
	 * Get a unique identifier for the event to be used in FullCalendar..
	 */
	abstract get identifier(): string;

	/**
	 * Each type of event has its own prefix to reconstruct a model instance from the data stored
	 * inside the FullCalendar plugin.
	 */
	abstract get PREFIX(): string;

	get idForCalendar(): string {
		return this.PREFIX + CalendarEvent.ID_SEPARATOR + this.identifier;
	}

	/**
	 * @returns An event for the FullCalendar plugin to parse and display.
	 */
	toCalendarEvent(): EventInput {
		return parseFrontmatter(this.idForCalendar, this.data);
	}

	/**
	 * Get a copy of the frontmatter information that created this event.
	 */
	get data(): EventFrontmatter {
		return { ...this._data };
	}

	/**
	 * Add this event to the provided FullCalendar calendar instance.
	 * @param calendar
	 * @param source User settings containing information about how this event should be displayed in the calendar.
	 */
	addTo(calendar: Calendar, source: CalendarSource) {
		calendar.addEvent({
			color:
				source.color ||
				getComputedStyle(document.body).getPropertyValue(
					"--interactive-accent"
				),
			textColor: getComputedStyle(document.body).getPropertyValue(
				"--text-on-accent"
			),
			...this.toCalendarEvent(),
		});
	}
}

/**
 * Additional functions for editable events.
 */
export abstract class EditableEvent extends CalendarEvent {
	constructor(cache: MetadataCache, vault: Vault, data: EventFrontmatter) {
		super(cache, vault, data);
	}

	get editable(): boolean {
		return true;
	}

	abstract setData(data: EventFrontmatter): Promise<void>;
	abstract delete(): Promise<void>;
}

export abstract class LocalEvent extends EditableEvent {
	abstract openIn(leaf: WorkspaceLeaf): Promise<void>;
	abstract get path(): string;
}
