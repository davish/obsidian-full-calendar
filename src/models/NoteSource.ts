import { EventInput, EventSourceInput } from "@fullcalendar/core";
import { MetadataCache, TFile, TFolder, Vault } from "obsidian";
import { FCError, LocalCalendarSource } from "src/types";
import { NoteEvent } from "./NoteEvent";
import { EventSource } from "./EventSource";

export class NoteSource extends EventSource {
	info: LocalCalendarSource;
	vault: Vault;
	cache: MetadataCache;

	constructor(vault: Vault, cache: MetadataCache, info: LocalCalendarSource) {
		super();
		this.vault = vault;
		this.cache = cache;
		this.info = info;
	}

	private getEventInputsFromPath(
		recursive?: boolean,
		path?: string
	): EventInput[] | FCError {
		const eventFolder = this.vault.getAbstractFileByPath(
			path || this.info.directory
		);
		if (!(eventFolder instanceof TFolder)) {
			return new FCError("Directory");
		}

		let events: EventInput[] = [];
		for (let file of eventFolder.children) {
			if (file instanceof TFile) {
				let event = NoteEvent.fromFile(this.cache, this.vault, file);
				if (event) {
					events.push(event.toCalendarEvent());
				}
			} else if (recursive) {
				const childEvents = this.getEventInputsFromPath(
					recursive,
					file.path
				);
				if (childEvents instanceof FCError) {
					return childEvents;
				}
				events.push(...childEvents);
			}
		}
		return events;
	}

	async toApi(recursive = false): Promise<EventSourceInput | FCError> {
		const events = this.getEventInputsFromPath(recursive);
		if (events instanceof FCError) {
			return events;
		}
		return {
			events,
			textColor: getComputedStyle(document.body).getPropertyValue(
				"--text-on-accent"
			),
			color:
				this.info.color ||
				getComputedStyle(document.body).getPropertyValue(
					"--interactive-accent"
				),
		};
	}
}
