import { EventInput, EventSourceInput } from "@fullcalendar/core";
import {
	normalizePath,
	MetadataCache,
	request,
	TFile,
	TFolder,
	Vault,
} from "obsidian";
import {
	FCError,
	CalDAVSource,
	ICloudSource,
	ICalSource,
	LocalCalendarSource,
} from "src/types";
import { IcalExpander } from "vendor/fullcalendar-ical/ical-expander/IcalExpander";
import {
	expandICalEvents,
	makeICalExpander,
} from "vendor/fullcalendar-ical/icalendar";
import { NoteEvent } from "./NoteEvent";
import { CalDAVEvent, CalDAVCalendarCache } from "./CalDAVEvent";
import Color from "color";
import * as dav from "dav";
import * as transport from "src/transport";

export abstract class EventSource {
	abstract toApi(): Promise<EventSourceInput | EventSourceInput[] | FCError>;
}

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

	private async getEventInputsFromPath(
		recursive?: boolean,
		path?: string
	): Promise<EventInput[] | FCError> {
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
				const childEvents = await this.getEventInputsFromPath(
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

	async toApi(
		recursive = false
	): Promise<EventSourceInput | EventSourceInput[] | FCError> {
		const events = await this.getEventInputsFromPath(recursive);
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

export class IcsSource extends EventSource {
	info: ICalSource;
	constructor(info: ICalSource) {
		super();
		this.info = info;
	}

	async toApi(): Promise<EventSourceInput | EventSourceInput[] | FCError> {
		let url = this.info.url;
		if (url.startsWith("webcal")) {
			url = "https" + url.slice("webcal".length);
		}
		let expander: IcalExpander | null = null;
		const getExpander = async (): Promise<IcalExpander | FCError> => {
			if (expander !== null) {
				return expander;
			}
			try {
				let text = await request({
					url: url,
					method: "GET",
				});
				expander = makeICalExpander(text);
				return expander;
			} catch (e) {
				console.error(`Error loading calendar from ${url}`);
				console.error(e);
				return new FCError(
					`There was an error loading a calendar. Check the console for full details.`
				);
			}
		};
		return {
			events: async function ({ start, end }) {
				const ical = await getExpander();
				if (ical instanceof FCError) {
					throw new Error("Could not get calendar: " + ical.message);
				}
				const events = expandICalEvents(ical, {
					start,
					end,
				});
				return events;
			},
			editable: false,
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

export class RemoteSource extends EventSource {
	vault: Vault;
	cache: MetadataCache;
	info: CalDAVSource | ICloudSource;

	constructor(
		vault: Vault,
		cache: MetadataCache,
		info: CalDAVSource | ICloudSource
	) {
		super();
		this.vault = vault;
		this.cache = cache;
		this.info = info;
	}

	get cacheDirectory(): string {
		return `${this.info.directory}/.cache`;
	}

	eventPath(url: string): string {
		return `${this.cacheDirectory}/${encodeURIComponent(url)}`;
	}

	calendarPath(url: string): string {
		return `${this.cacheDirectory}/${encodeURIComponent(url)}.json`;
	}

	async readCache(): Promise<CalDAVCalendarCache | null> {
		const calendarPath = this.calendarPath(this.info.url);
		if (!this.vault.adapter.exists(calendarPath)) {
			return null;
		}

		const calendarCache = JSON.parse(
			await this.vault.adapter.read(calendarPath)
		) as CalDAVCalendarCache;

		return calendarCache;
	}

	async emptyCache() {
		const calendarCache = await this.readCache();
		if (calendarCache == null) {
			return;
		}

		let paths: string[] = [];
		Object.keys(calendarCache.events).forEach((url) => {
			paths.push(normalizePath(this.eventPath(url)));
		});

		await Promise.all(
			paths.map(async (path) => {
				if (await this.vault.adapter.exists(path)) {
					await this.vault.adapter.remove(path);
				}
			})
		);
		await this.vault.adapter.remove(this.calendarPath(this.info.url));
	}

	async importCalendars(): Promise<CalDAVSource[] | FCError> {
		try {
			const sourceFolder = this.vault.getAbstractFileByPath(
				this.info.directory
			);
			if (!(sourceFolder instanceof TFolder)) {
				return new FCError("Directory");
			}
			const cacheFolder = this.vault.getAbstractFileByPath(
				this.cacheDirectory
			);
			if (!(cacheFolder instanceof TFolder)) {
				await this.vault.createFolder(this.cacheDirectory);
			}

			let xhr = new transport.Basic(
				new dav.Credentials({
					username: this.info.username,
					password: this.info.password,
				})
			);

			let account = await dav.createAccount({
				xhr: xhr,
				server: this.info.url,
				loadObjects: true,
				loadCollections: true,
			});

			let colorRequest = dav.request.propfind({
				props: [
					{ name: "calendar-color", namespace: dav.ns.CALDAV_APPLE },
				],
				depth: "0",
			});

			const sources = await Promise.all(
				account.calendars.map(async (calendar) => {
					if (!calendar.components.includes("VEVENT")) {
						return null;
					}
					const events = await Promise.all(
						calendar.objects.map(async (event) => {
							if (!event.calendarData) {
								return null;
							}
							await this.vault.create(
								this.eventPath(event.url),
								event.calendarData
							);
							return { url: event.url, etag: event.etag };
						})
					);

					await this.vault.create(
						this.calendarPath(calendar.url),
						JSON.stringify({
							ctag: calendar.ctag,
							events: events.reduce(
								(events, event) =>
									event != null
										? { ...events, [event.url]: event.etag }
										: events,
								{}
							),
						})
					);

					let colorResponse = await xhr.send(
						colorRequest,
						calendar.url
					);

					let color = colorResponse[0].props?.calendarColor;
					let calendarColor = color
						? Color(color).hex()
						: this.info.color;
					return {
						...this.info,
						type: "caldav",
						url: calendar.url,
						ctag: calendar.ctag,
						name: calendar.displayName,
						color: calendarColor,
					};
				})
			);
			return sources.filter(
				(source): source is CalDAVSource => source != null
			);
		} catch (e) {
			console.error(`Error importing calendars from ${this.info.url}`);
			console.error(e);
			return new FCError(
				`There was an error loading a calendar. Check the console for full details.`
			);
		}
	}

	async toApi(): Promise<EventSourceInput | EventSourceInput[] | FCError> {
		const calendarCache = await this.readCache();
		if (calendarCache === null) {
			const calendarPath = this.calendarPath(this.info.url);
			return [new FCError(`Unable to load ${calendarPath}`)];
		}

		let eventPromises: Promise<CalDAVEvent | null>[] = [];
		Object.keys(calendarCache.events).forEach((url) => {
			eventPromises.push(
				CalDAVEvent.fromPath(
					this.cache,
					this.vault,
					this.eventPath(url)
				)
			);
		});

		let events = (
			await Promise.all(
				eventPromises.map(async (eventPromise) => {
					try {
						let event = await eventPromise;
						if (event != null) {
							return event.toCalendarEvent();
						}
					} catch (e) {
						console.error(`Error importing event`);
						console.error(e);
					}
				})
			)
		).filter((event): event is EventInput => event != undefined);

		// Functions are used for rrule events
		let eventFunctions = events.filter(
			(event) => typeof event === "function"
		);
		events = events.filter((event) => typeof event !== "function");
		let baseSource = {
			events,
			editable: false,
			textColor: getComputedStyle(document.body).getPropertyValue(
				"--text-on-accent"
			),
			color:
				this.info.color ||
				getComputedStyle(document.body).getPropertyValue(
					"--interactive-accent"
				),
		};

		return eventFunctions
			.map((func) => ({ ...baseSource, events: func }))
			.concat([baseSource]);
	}
}
