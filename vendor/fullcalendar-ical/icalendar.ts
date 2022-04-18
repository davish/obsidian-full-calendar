import {
	EventInput,
	DateRange,
	addDays,
} from "@fullcalendar/common";
// @ts-ignore
import * as ICAL from "ical.js";
import { IcalExpander } from "./ical-expander/IcalExpander";

export function makeICalExpander(text: string): IcalExpander {
	return new IcalExpander({
		ics: text,
		skipInvalidDates: true,
	});
}

export function extractEventProperty(iCalEvent: ICAL.Event, propertyName: string): string {
	let property = iCalEvent.component.getFirstProperty(propertyName);
	return property ? property.getFirstValue() : "";
}

export function expandICalEvents(
	iCalExpander: IcalExpander,
	range: DateRange
): EventInput[] {
	// expand the range. because our `range` is timeZone-agnostic UTC
	// or maybe because ical.js always produces dates in local time? i forget
	let rangeStart = addDays(range.start, -1);
	let rangeEnd = addDays(range.end, 1);

	let iCalRes = iCalExpander.between(rangeStart, rangeEnd); // end inclusive. will give extra results
	let expanded: EventInput[] = [];

	// TODO: instead of using startDate/endDate.toString to communicate allDay,
	// we can query startDate/endDate.isDate. More efficient to avoid formatting/reparsing.

	// single events
	for (let iCalEvent of iCalRes.events) {
		expanded.push({
			...buildNonDateProps(iCalEvent),
			start: iCalEvent.startDate.toString(),
			end:
				specifiesEnd(iCalEvent) && iCalEvent.endDate
					? iCalEvent.endDate.toString()
					: null,
		});
	}

	// recurring event instances
	for (let iCalOccurence of iCalRes.occurrences) {
		let iCalEvent = iCalOccurence.item;
		expanded.push({
			...buildNonDateProps(iCalEvent),
			start: iCalOccurence.startDate.toString(),
			end:
				specifiesEnd(iCalEvent) && iCalOccurence.endDate
					? iCalOccurence.endDate.toString()
					: null,
		});
	}

	return expanded;
}

function buildNonDateProps(iCalEvent: ICAL.Event): EventInput {
	return {
		title: iCalEvent.summary,
		url: extractEventProperty(iCalEvent, "url"),
		extendedProps: {
			location: iCalEvent.location,
			organizer: iCalEvent.organizer,
			description: iCalEvent.description,
		},
	};
}

function specifiesEnd(iCalEvent: ICAL.Event) {
	return (
		Boolean(iCalEvent.component.getFirstProperty("dtend")) ||
		Boolean(iCalEvent.component.getFirstProperty("duration"))
	);
}
