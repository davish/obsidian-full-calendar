import { normalizePath, MetadataCache, Vault } from "obsidian";
import { icsToFrontmatter } from "src/frontmatter";
import { EventFrontmatter } from "src/types";
import { CalendarEvent } from "./Event";

type CalDAVETag = string;
type CalDAVEventURL = string;

export type CalDAVCalendarCache = {
	ctag: string;
	events: { [index: CalDAVEventURL]: CalDAVETag };
};

export class CalDAVEvent extends CalendarEvent {
	icsData: string;
	path: string;

	static ID_PREFIX = "caldav";
	get identifier(): string {
		return this.path;
	}

	get PREFIX(): string {
		return CalDAVEvent.ID_PREFIX;
	}

	get url(): string {
		return decodeURIComponent(
			this.path.slice(this.path.lastIndexOf("/") + 1)
		);
	}

	constructor(
		cache: MetadataCache,
		vault: Vault,
		data: EventFrontmatter,
		{
			icsData,
			path,
		}: {
			icsData: string;
			path: string;
		}
	) {
		super(cache, vault, data);

		this.icsData = icsData;
		this.path = path;
	}

	static async fromPath(
		cache: MetadataCache,
		vault: Vault,
		path: string
	): Promise<CalDAVEvent | null> {
		path = normalizePath(path);
		if (!(await vault.adapter.exists(path))) {
			return null;
		}

		let icsData = await vault.adapter.read(path);
		return new CalDAVEvent(cache, vault, icsToFrontmatter(icsData), {
			icsData: icsData,
			path: path,
		});
	}
}
