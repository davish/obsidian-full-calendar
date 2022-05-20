import { MetadataCache, Vault } from "obsidian";

export const PLUGIN_SLUG = "full-calendar-plugin";

// Frontmatter
export type AllDayFrontmatter = {
	allDay: true;
};

export type RangeTimeFrontmatter = {
	allDay: false;
	startTime: string;
	endTime: string | null;
};

export type CommonEventFrontmatter = {
	title?: string;
} & (RangeTimeFrontmatter | AllDayFrontmatter);

export type SingleEventFrontmatter = {
	type?: "single";
	date: string;
	endDate?: string;
} & CommonEventFrontmatter;

export type RecurringEventFrontmatter = {
	type: "recurring";
	daysOfWeek: string[];
	startRecur?: string;
	endRecur?: string;
} & CommonEventFrontmatter;

export type EventFrontmatter =
	| SingleEventFrontmatter
	| RecurringEventFrontmatter;

/*
 * Validates that an incoming object from a JS object (presumably parsed from a note's frontmatter)
 * is a valid event, and returns that event if so. If any required fields are missing, then returns null.
 */
export function validateFrontmatter(
	obj?: Record<string, any>
): EventFrontmatter | null {
	if (obj === undefined) {
		return null;
	}

	if (!obj.title) {
		return null;
	}

	if (!obj.allDay && !obj.startTime) {
		return null;
	}

	const timeInfo: RangeTimeFrontmatter | AllDayFrontmatter = obj.allDay
		? { allDay: true }
		: {
				allDay: false,
				startTime: obj.startTime,
				endTime: obj.endTime,
		  };

	if (obj.type === undefined || obj.type === "single") {
		if (!obj.date) {
			return null;
		}
		return {
			title: obj.title,
			type: "single",
			date: obj.date,
			endDate: obj.endDate,
			...timeInfo,
		};
	} else if (obj.type === "recurring") {
		if (obj.daysOfWeek === undefined) {
			return null;
		}
		return {
			title: obj.title,
			type: "recurring",
			daysOfWeek: obj.daysOfWeek,
			startRecur: obj.startRecur,
			endRecur: obj.endRecur,
			...timeInfo,
		};
	}

	return null;
}

// Settings

type CalendarSourceCommon = {
	color: string;
};

/**
 * Local calendar with events stored as files in a directory.
 */
export type LocalCalendarSource = {
	type: "local";
	directory: string;
} & CalendarSourceCommon;

/**
 * Readonly mirror of a remote calendar located at the given URL.
 */
export type ICalSource = {
	type: "ical";
	url: string;
} & CalendarSourceCommon;

/**
 * Auth types. Currently only support Basic, but will probably support OAuth in the future.
 */
type BasicAuth = {
	username: string;
	password: string;
} & CalendarSourceCommon;

type AuthType = BasicAuth;

/**
 * Read/write mirror of a remote CalDAV backed calendar at the given URL.
 */
export type CalDAVSource = {
	type: "caldav";
	name: string;
	url: string;
	homeUrl: string;
} & CalendarSourceCommon &
	AuthType;

/**
 * An read/write mirror of an iCloud backed calendar.
 */
export type ICloudSource = Omit<CalDAVSource, "type" | "url"> & {
	type: "icloud";
	url: "https://caldav.icloud.com";
};

export type CalendarSource =
	| LocalCalendarSource
	| ICalSource
	| CalDAVSource
	| ICloudSource;

/**
 * Construct a partial calendar source of the specified type
 */
export function makeDefaultPartialCalendarSource(
	type: CalendarSource["type"]
): Partial<CalendarSource> {
	if (type === "icloud") {
		return {
			type: type,
			color: getComputedStyle(document.body)
				.getPropertyValue("--interactive-accent")
				.trim(),
			url: "https://caldav.icloud.com",
		} as Partial<ICloudSource>;
	}

	return {
		type: type,
		color: getComputedStyle(document.body)
			.getPropertyValue("--interactive-accent")
			.trim(),
	};
}

export class FCError {
	message: string;
	constructor(message: string) {
		this.message = message;
	}
}
