import { MetadataCache, Pos, TFile, Vault, WorkspaceLeaf } from "obsidian";
import { EventFrontmatter, validateFrontmatter } from "src/types";
import { CalendarEvent, LocalEvent } from "./Event";

const parseBool = (s: string): boolean | string =>
	s === "true" ? true : s === "false" ? false : s;

const fieldRegex = /\[([^\]]+):: ?([^\]]+)\]/g;
function getInlineFields(s: string): Record<string, string | boolean> {
	return Object.fromEntries(
		Array.from(s.matchAll(fieldRegex)).map((m) => [m[1], parseBool(m[2])])
	);
}
export class InlineNoteEvent extends CalendarEvent {
	file: TFile;
	position: Pos;

	constructor(
		cache: MetadataCache,
		vault: Vault,
		data: EventFrontmatter,
		{ file, position }: { file: TFile; position: Pos }
	) {
		super(cache, vault, data);
		this.file = file;
		this.position = position;
	}

	static fromTextAndPosition(
		cache: MetadataCache,
		vault: Vault,
		file: TFile,
		text: string,
		position: Pos
	): InlineNoteEvent | null {
		const data = validateFrontmatter({
			title: text.replace(fieldRegex, "").trim(),
			...getInlineFields(text),
		});
		if (!data) {
			return null;
		}
		return new InlineNoteEvent(cache, vault, data, { file, position });
	}

	get identifier(): string {
		throw new Error("Method not implemented.");
	}
	get PREFIX(): string {
		return "inline";
	}
}
