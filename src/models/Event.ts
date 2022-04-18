import { Calendar, EventInput } from "@fullcalendar/core";
import { MetadataCache, Vault, WorkspaceLeaf } from "obsidian";
import { parseFrontmatter } from "src/frontmatter";
import { CalendarSource, EventFrontmatter } from "src/types";

export function basenameFromEvent(event: EventFrontmatter): string {
	switch (event.type) {
		case "single":
		case undefined:
			return `${event.date} ${event.title}`;
		case "recurring":
			return `(Every ${event.daysOfWeek.join(",")}) ${event.title})`;
		case "rrule":
			return `(${event.rrule}) ${event.title})`;
	}
}

export const getPathPrefix = (path: string): string =>
	path.split("/").slice(0, -1).join("/");

export abstract class CalendarEvent {
	static ID_SEPARATOR = "::";
	cache: MetadataCache;
	vault: Vault;

	protected _data: EventFrontmatter;

	constructor(cache: MetadataCache, vault: Vault, data: EventFrontmatter) {
		this.cache = cache;
		this.vault = vault;
		this._data = data;
	}

	abstract get identifier(): string;
	abstract get PREFIX(): string;
	get idForCalendar(): string {
		return this.PREFIX + CalendarEvent.ID_SEPARATOR + this.identifier;
	}

	toCalendarEvent(): EventInput {
		return parseFrontmatter(this.idForCalendar, this.data);
	}

	get data(): EventFrontmatter {
		return { ...this._data };
	}

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
