import { CachedMetadata, ListItemCache, Pos, TFile, Vault } from "obsidian";
import { OFCEvent, SingleEventData, validateEvent } from "src/types";

// PARSING

type Line = {
	text: string;
	pos: Pos;
};

// TODO: This is O(n*m), but it can definitely be optimized to O(n).
export function extractTextFromPositions(
	content: string,
	positions: Pos[]
): Line[] {
	return positions.map((pos) => ({
		text: content.substring(pos.start.offset, pos.end.offset),
		pos,
	}));
}

const parseBool = (s: string): boolean | string =>
	s === "true" ? true : s === "false" ? false : s;

const fieldRegex = /\[([^\]]+):: ?([^\]]+)\]/g;
function getInlineAttributes(s: string): Record<string, string | boolean> {
	return Object.fromEntries(
		Array.from(s.matchAll(fieldRegex)).map((m) => [m[1], parseBool(m[2])])
	);
}

export const getHeadingPosition = (
	headingText: string,
	metadata: CachedMetadata
): Pos | null => {
	if (!metadata.headings) {
		return null;
	}

	let level: number | null = null;
	let startingPos: Pos | null = null;
	let endingPos: Pos | null = null;

	for (const heading of metadata.headings) {
		if (!level && heading.heading === headingText) {
			level = heading.level;
			startingPos = heading.position;
		} else if (level && heading.level <= level) {
			endingPos = heading.position;
			break;
		}
	}

	if (!level || !startingPos || !endingPos) {
		return null;
	}

	return { start: startingPos.end, end: endingPos.start };
};

export const getListsUnderHeading = (
	headingText: string,
	metadata: CachedMetadata
): ListItemCache[] => {
	if (!metadata.listItems) {
		return [];
	}
	const headingPos = getHeadingPosition(headingText, metadata);
	if (!headingPos) {
		return [];
	}
	return metadata.listItems?.filter(
		(l) =>
			headingPos.start.offset < l.position.start.offset &&
			l.position.end.offset < headingPos.end.offset
	);
};

const listRegex = /^(\s*)\-\s+(\[(.)\]\s+)?/;
const checkboxRegex = /^\s*\-\s+\[(.)\]\s+/;
const checkboxTodo = (s: string) => {
	const match = s.match(checkboxRegex);
	if (!match || !match[1]) {
		return null;
	}
	return match[1] === " " ? false : match[1];
};
export const getInlineEventFromLine = (
	text: string,
	globalAttrs: Partial<OFCEvent>
): OFCEvent | null => {
	const attrs = getInlineAttributes(text);

	// Shortcut validation if there are no inline attributes.
	if (Object.keys(attrs).length === 0) {
		return null;
	}

	return validateEvent({
		title: text.replace(listRegex, "").replace(fieldRegex, "").trim(),
		completed: checkboxTodo(text),
		...globalAttrs,
		...attrs,
	});
};

export function getAllInlineEventsFromFile(
	fileText: string,
	listItems: ListItemCache[],
	fileGlobalAttrs: Partial<OFCEvent>
): { pos: Pos; event: OFCEvent }[] {
	const listItemText: Line[] = extractTextFromPositions(
		fileText,
		listItems.map((i) => i.position)
	);

	return listItemText
		.map((l) => ({
			pos: l.pos,
			event: getInlineEventFromLine(l.text, {
				...fileGlobalAttrs,
				type: "single",
			}),
		}))
		.flatMap(({ event, pos }) => (event ? [{ event, pos }] : []));
}

// SERIALIZATION

export function withFile(
	vault: Vault,
	file: TFile,
	processText: (text: string, ...other: any[]) => string | null
) {
	return async (...other: any[]) => {
		const modifiedFile = processText(await vault.read(file), ...other);
		if (!modifiedFile) {
			return;
		}
		return vault.modify(file, modifiedFile);
	};
}

export const generateInlineAttributes = (
	attrs: Record<string, any>
): string => {
	return Object.entries(attrs)
		.map(([k, v]) => `[${k}:: ${v}]`)
		.join("  ");
};

const replaceAtPos = (
	text: string,
	position: Pos,
	replacement: string
): string =>
	text.substring(0, position.start.offset) +
	replacement +
	text.substring(position.end.offset);

export const modifyListItem = (
	page: string,
	position: Pos,
	newListItem: SingleEventData,
	keysToIgnore: (keyof SingleEventData)[]
): string | null => {
	let line = page.substring(position.start.offset, position.end.offset);
	const listMatch = line.match(listRegex);
	if (!listMatch) {
		console.warn(
			"Tried modifying a list item with a position that wasn't a list item",
			{ position, line }
		);
		return null;
	}
	const oldTitle = line.replace(listRegex, "").replace(fieldRegex, "").trim();
	const { completed: newCompleted, title: newTitle } = newListItem;
	const checkbox = (() => {
		if (newCompleted !== null && newCompleted !== undefined) {
			return `[${newCompleted ? "x" : " "}]`;
		}
		return null;
	})();

	delete newListItem["completed"];
	delete newListItem["title"];
	for (const key of keysToIgnore) {
		delete newListItem[key];
	}

	const newAttrs: Partial<SingleEventData> = { ...newListItem };

	for (const key of <(keyof SingleEventData)[]>Object.keys(newAttrs)) {
		if (newAttrs[key] === undefined || newAttrs[key] === null) {
			delete newAttrs[key];
		}
	}

	if (!newAttrs["allDay"]) {
		delete newAttrs["allDay"];
	}

	const newLine = `${listMatch[1]}- ${checkbox || ""} ${
		newTitle || oldTitle
	} ${generateInlineAttributes(newAttrs)}`;

	return replaceAtPos(page, position, newLine);
};
