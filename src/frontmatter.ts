import { EventApi, EventInput } from "@fullcalendar/core";
import { DateTime, Duration } from "luxon";
import { MetadataCache, parseYaml, TFile, Vault } from "obsidian";
import {
	add,
	getDate,
	getTime,
	normalizeTimeString,
	parseTime,
} from "./dateUtil";
import { EventFrontmatter } from "./types";

const DAYS = "UMTWRFS";

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
		endDate,
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
