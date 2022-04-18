import { EventApi, EventInput } from "@fullcalendar/core";
import { DateTime, Duration } from "luxon";
import { parseYaml, TFile, Vault } from "obsidian";
import {
	add,
	getDate,
	getTime,
	normalizeTimeString,
	parseTime,
} from "./dateUtil";
import { EventFrontmatter, RecurrenceException } from "./types";
import {
	makeICalExpander,
	extractEventProperty,
} from "vendor/fullcalendar-ical/icalendar";
import { rrulestr } from "rrule";

const DAYS = "UMTWRFS";

type EventSourceFuncArgs = {
	start: Date;
	end: Date;
	startStr: string;
	endStr: string;
	timeZone: string;
};

// fullcalendar does not export it, so recreate here. taken from:
// https://github.com/fullcalendar/fullcalendar/blob/f6b0acf48/packages/common/src/structs/event-source.ts
type EventSourceError = {
	message: string;
	response?: any; // an XHR or something like it
	[otherProp: string]: any;
};

type EventSourceSuccessCallback = (events: EventInput[]) => void;
type EventSourceFailureCallback = (error: EventSourceError) => void;

export function dateEndpointsToFrontmatter(
	start: Date,
	end: Date,
	allDay: boolean
): Partial<EventFrontmatter> {
	const date = getDate(start);
	const endDate = getDate(end);
	return {
		type: "single",
		date,
		endDate: date !== endDate ? endDate : undefined,
		allDay,
		...(allDay
			? {}
			: {
					startTime: getTime(start),
					endTime: getTime(end),
			  }),
	};
}

export function parseFrontmatter(
	id: string,
	frontmatter: EventFrontmatter
): EventInput {
	let event: EventInput = {
		id,
		title: frontmatter.title,
		allDay: frontmatter.allDay,
	};
	if (frontmatter.type === "recurring") {
		event = {
			...event,
			daysOfWeek: frontmatter.daysOfWeek.map((c) => DAYS.indexOf(c)),
			startRecur: frontmatter.startRecur,
			endRecur: frontmatter.endRecur,
		};
		if (!frontmatter.allDay) {
			event = {
				...event,
				startTime: normalizeTimeString(frontmatter.startTime || ""),
				endTime: frontmatter.endTime
					? normalizeTimeString(frontmatter.endTime)
					: undefined,
			};
		}
	} else if (frontmatter.type === "rrule") {
		let baseEvent = event;
		let startDate = DateTime.fromISO(frontmatter.date);
		let endDate = DateTime.fromISO(frontmatter.endDate);

		let duration = endDate.diff(startDate);
		let startTime = Duration.fromISOTime(getTime(startDate.toJSDate()));
		let exceptions = frontmatter.recurrenceExceptions?.reduce(
			(exceptions, exception) => ({
				...exceptions,
				[exception.exceptionDate]: {
					...(exception?.title ? { title: exception?.title } : {}),
					date: exception.date,
					endDate: exception.endDate,
				},
			}),
			{}
		);

		// Return a function that expands events from the rrule
		event = (
			args: EventSourceFuncArgs,
			successCallback: EventSourceSuccessCallback,
			failureCallback: EventSourceFailureCallback
		) => {
			try {
				let invalid = {};
				let occurrences = frontmatter.rrule
					.between(args.start, args.end)
					.map((occurrenceDate) => {
						let start = add(
							DateTime.fromJSDate(occurrenceDate),
							startTime
						).toISO();
						let end = add(
							DateTime.fromJSDate(occurrenceDate),
							startTime
						).toISO();
						return exceptions === undefined ||
							!(start in exceptions)
							? {
									...baseEvent,
									start: start,
									end: end,
							  }
							: invalid;
					})
					.filter((event): event is EventInput => event !== invalid);

				if (exceptions != undefined) {
					let start = args.start;
					let end = args.end;
					Object.entries(exceptions).forEach(
						([exceptionDate, exceptionInfo]) => {
							let exceptionDateJS =
								DateTime.fromISO(exceptionDate).toJSDate();
							if (
								exceptionDateJS >= start &&
								exceptionDateJS <= end
							) {
								occurrences.push({
									...baseEvent,
									...(exceptionInfo?.title
										? { title: exceptionInfo?.title }
										: {}),
									start: exceptionInfo.date,
									end: exceptionInfo.endDate,
								});
							}
						}
					);
				}

				successCallback(occurrences);
			} catch (e) {
				failureCallback({ message: "Unable to parse rrule", error: e });
			}
		};
	} else {
		if (!frontmatter.allDay) {
			event = {
				...event,
				start: add(
					DateTime.fromISO(frontmatter.date),
					parseTime(frontmatter.startTime || "")
				).toISO(),
				end: frontmatter.endTime
					? add(
							DateTime.fromISO(
								frontmatter.endDate || frontmatter.date
							),
							parseTime(frontmatter.endTime)
					  ).toISO()
					: undefined,
			};
		} else {
			event = {
				...event,
				start: frontmatter.date,
				end: frontmatter.endDate || undefined,
			};
		}
	}

	return event;
}

export function eventApiToFrontmatter(event: EventApi): EventFrontmatter {
	// TODO: Handle rrule
	const isRecurring: boolean = event.extendedProps.daysOfWeek !== undefined;
	const startDate = getDate(event.start as Date);
	const endDate = getDate(event.end as Date);
	return {
		title: event.title,
		...(event.allDay
			? { allDay: true }
			: {
					allDay: false,
					startTime: getTime(event.start as Date),
					endTime: getTime(event.end as Date),
			  }),

		...(isRecurring
			? {
					type: "recurring",
					daysOfWeek: event.extendedProps.daysOfWeek.map(
						(i: number) => DAYS[i]
					),
					startRecur:
						event.extendedProps.startRecur &&
						getDate(event.extendedProps.startRecur),
					endRecur:
						event.extendedProps.endRecur &&
						getDate(event.extendedProps.endRecur),
			  }
			: {
					type: "single",
					date: startDate,
					...(startDate !== endDate ? { endDate } : {}),
			  }),
	};
}

export function icsToFrontmatter(icsString: string): EventFrontmatter {
	const expander = makeICalExpander(icsString);
	if (expander.events.length === 0) {
		throw new Error("No event in the calendar!");
	}

	// While there might be multiple events in the calendar, they should all be related to
	// different occurrences of the same event as denoted by recurrence-id, see:
	// https://datatracker.ietf.org/doc/html/draft-ietf-calsify-rfc2445bis-10#section-3.8.4.4
	if (new Set(expander.events.map((event) => event.uid)).size > 1) {
		throw new Error("Got multiple events, but expected only one!");
	}

	const event = expander.events[0];
	const startDateTime = event.startDate.toJSDate() as Date;
	const endDateTime = event.endDate.toJSDate() as Date;

	const allDay =
		event.startDate.isDate &&
		!event.duration.hours &&
		!event.duration.minutes &&
		!event.duration.seconds;

	let commonFrontmatter = {
		allDay,
		title: event.summary,
		date: DateTime.fromJSDate(startDateTime).toISO(),
		endDate: DateTime.fromJSDate(endDateTime).toISO(),
	};

	if (event.isRecurring()) {
		// DTSTART has already been pulled out as startDate, but needed for
		// rrule. If not specified it'll default to the current time.
		// rrulestr is supposed to take a default dtstart as an option, but
		// that doesn't work properly. See:
		// https://github.com/jakubroztocil/rrule/issues/413
		const dtstart = DateTime.fromJSDate(startDateTime)
			.toUTC()
			.toISO({ suppressMilliseconds: true, format: "basic" });
		const rrule = extractEventProperty(event, "rrule").toString();
		const exceptions = expander.events
			.map((event) =>
				event.isRecurrenceException()
					? {
							...(event?.summary ? { title: event.summary } : {}),
							date: DateTime.fromJSDate(
								event.startDate.toJSDate()
							).toISO(),
							endDate: DateTime.fromJSDate(
								event.endDate.toJSDate()
							).toISO(),
							exceptionDate: DateTime.fromISO(
								event.recurrenceId
							).toISO(),
					  }
					: null
			)
			.filter(
				(exception): exception is RecurrenceException =>
					exception != null
			);

		return {
			type: "rrule",
			...commonFrontmatter,
			rrule: rrulestr(`DTSTART:${dtstart}\n${rrule}`),
			...(exceptions.length ? { recurrenceExceptions: exceptions } : {}),
		};
	}

	return {
		type: "single",
		...commonFrontmatter,
		...(allDay
			? { allDay: true }
			: {
					allDay: false,
					startTime: getTime(startDateTime),
					endTime: getTime(endDateTime),
			  }),
	};
}

const FRONTMATTER_SEPARATOR = "---";

/**
 * @param page Contents of a markdown file.
 * @returns Whether or not this page has a frontmatter section.
 */
function hasFrontmatter(page: string): boolean {
	return (
		page.indexOf(FRONTMATTER_SEPARATOR) === 0 &&
		page.slice(3).indexOf(FRONTMATTER_SEPARATOR) !== -1
	);
}

/**
 * Return only frontmatter from a page.
 * @param page Contents of a markdown file.
 * @returns Frontmatter section of a page.
 */
function extractFrontmatter(page: string): string | null {
	if (hasFrontmatter(page)) {
		return page.split(FRONTMATTER_SEPARATOR)[1];
	}
	return null;
}

/**
 * Remove frontmatter from a page.
 * @param page Contents of markdown file.
 * @returns Contents of a page without frontmatter.
 */
function extractPageContents(page: string): string {
	if (hasFrontmatter(page)) {
		// Frontmatter lives between the first two --- linebreaks.
		return page.split("---").slice(2).join("---");
	} else {
		return page;
	}
}

function replaceFrontmatter(page: string, newFrontmatter: string): string {
	return `---\n${newFrontmatter}---${extractPageContents(page)}`;
}

type PrintableAtom = Array<number | string> | number | string | boolean;

function stringifyYamlAtom(v: PrintableAtom): string {
	let result = "";
	if (Array.isArray(v)) {
		result += "[";
		result += v.map(stringifyYamlAtom).join(",");
		result += "]";
	} else {
		result += `${v}`;
	}
	return result;
}

function stringifyYamlLine(k: string | number | symbol, v: PrintableAtom) {
	return `${String(k)}: ${stringifyYamlAtom(v)}`;
}

/**
 * Modify frontmatter for an Obsidian file in-place, adding new entries to the end.
 * @param modifications Object describing modifications/additions to the frontmatter.
 * @param file File to modify.
 * @param vault Obsidian Vault API.
 * @returns Array of keys which were updated rather than newly created.
 */
export async function modifyFrontmatter(
	vault: Vault,
	file: TFile,
	modifications: Partial<EventFrontmatter>
): Promise<void> {
	let page = await vault.read(file);
	const frontmatter = extractFrontmatter(page)?.split("\n");
	let newFrontmatter: string[] = [];
	if (!frontmatter) {
		newFrontmatter = Object.entries(modifications)
			.filter(([k, v]) => v !== undefined)
			.map(([k, v]) => stringifyYamlLine(k, v));
		page = "\n" + page;
	} else {
		const linesAdded: Set<string | number | symbol> = new Set();
		// Modify rows in-place.
		for (let i = 0; i < frontmatter.length; i++) {
			const line: string = frontmatter[i];
			const obj: Record<any, any> | null = parseYaml(line);
			if (!obj) {
				continue;
			}

			const keys = Object.keys(obj) as [keyof EventFrontmatter];
			if (keys.length !== 1) {
				throw new Error("One YAML line parsed to multiple keys.");
			}
			const key = keys[0];
			linesAdded.add(key);
			const newVal: PrintableAtom | undefined = modifications[key];
			if (newVal !== undefined) {
				newFrontmatter.push(stringifyYamlLine(key, newVal));
			} else {
				// Just push the old line if we don't have a modification.
				newFrontmatter.push(line);
			}
		}

		// Add all rows that were not originally in the frontmatter.
		newFrontmatter.push(
			...(Object.keys(modifications) as [keyof EventFrontmatter])
				.filter((k) => !linesAdded.has(k))
				.filter((k) => modifications[k] !== undefined)
				.map((k) =>
					stringifyYamlLine(k, modifications[k] as PrintableAtom)
				)
		);
	}
	const newPage = replaceFrontmatter(page, newFrontmatter.join("\n") + "\n");
	await vault.modify(file, newPage);
}
