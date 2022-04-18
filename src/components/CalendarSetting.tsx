import { accessSync } from "fs";
import * as React from "react";
import { CalendarSource } from "../types";

type SourceWith<T extends Partial<CalendarSource>, K> = T extends K ? T : never;

interface BasicProps<T extends Partial<CalendarSource>> {
	source: T;
}

function DirectorySetting<T extends Partial<CalendarSource>>({
	source,
}: BasicProps<T>) {
	let sourceWithDirectory = source as SourceWith<T, { directory: undefined }>;
	return (
		<div className="setting-item-control">
			<input
				disabled
				type="text"
				value={sourceWithDirectory.directory}
				style={{
					width: "100%",
					marginLeft: 4,
					marginRight: 4,
				}}
			/>
		</div>
	);
}

function UrlSetting<T extends Partial<CalendarSource>>({
	source,
}: BasicProps<T>) {
	let sourceWithUrl = source as SourceWith<T, { url: undefined }>;
	return (
		<div className="setting-item-control">
			<input
				disabled
				type="text"
				value={sourceWithUrl.url}
				style={{
					width: "100%",
					marginLeft: 4,
					marginRight: 4,
				}}
			/>
		</div>
	);
}

function NameSetting<T extends Partial<CalendarSource>>({
	source,
}: BasicProps<T>) {
	let sourceWithName = source as SourceWith<T, { name: undefined }>;
	return (
		<div className="setting-item-control">
			<input
				disabled
				type="text"
				value={sourceWithName.name}
				style={{
					width: "100%",
					marginLeft: 4,
					marginRight: 4,
				}}
			/>
		</div>
	);
}

function Username<T extends Partial<CalendarSource>>({
	source,
}: BasicProps<T>) {
	let sourceWithUsername = source as SourceWith<T, { username: undefined }>;
	return (
		<div className="setting-item-control">
			<input
				disabled
				type="text"
				value={sourceWithUsername.username}
				style={{
					width: "100%",
					marginLeft: 4,
					marginRight: 4,
				}}
			/>
		</div>
	);
}

interface CalendarSettingsProps {
	setting: Partial<CalendarSource>;
	onColorChange: (s: string) => void;
	deleteCalendar: () => void;
}

export const CalendarSettingRow = ({
	setting,
	onColorChange,
	deleteCalendar,
}: CalendarSettingsProps) => {
	const isCalDAV = setting.type === "caldav" || setting.type === "icloud";
	return (
		<div className="setting-item">
			<button
				type="button"
				onClick={deleteCalendar}
				style={{ maxWidth: "15%" }}
			>
				✕
			</button>
			{setting.type === "local" ? (
				<DirectorySetting source={setting} />
			) : (
				<UrlSetting source={setting} />
			)}
			{isCalDAV && <NameSetting source={setting} />}
			{isCalDAV && <Username source={setting} />}
			<input
				style={{ maxWidth: "25%", minWidth: "3rem" }}
				type="color"
				value={setting.color}
				onChange={(e) => onColorChange(e.target.value)}
			/>
		</div>
	);
};

interface CalendarSettingProps {
	sources: CalendarSource[];
	submit: (payload: CalendarSource[]) => Promise<void>;
	sourcesUpdated: (
		oldSources: CalendarSource[],
		newSources: CalendarSource[]
	) => Promise<void>;
}
type CalendarSettingState = {
	sources: CalendarSource[];
	dirty: boolean;
};
export class CalendarSettings extends React.Component<
	CalendarSettingProps,
	CalendarSettingState
> {
	constructor(props: CalendarSettingProps) {
		super(props);
		this.state = { sources: props.sources, dirty: false };
	}

	componentDidUpdate(
		prevProps: CalendarSettingProps,
		previousState: CalendarSettingState
	) {
		prevProps.sourcesUpdated(previousState.sources, this.state.sources);
	}

	addSource(source: CalendarSource) {
		this.setState((state /*props*/) => ({
			sources: [...state.sources, source],
			dirty: true,
		}));
	}

	render() {
		return (
			<div style={{ width: "100%" }}>
				{this.state.sources.map((s, idx) => (
					<CalendarSettingRow
						key={idx}
						setting={s}
						onColorChange={(color) =>
							this.setState((state /*props*/) => ({
								sources: [
									...state.sources.slice(0, idx),
									{ ...state.sources[idx], color },
									...state.sources.slice(idx + 1),
								],
								dirty: true,
							}))
						}
						deleteCalendar={() =>
							this.setState((state /*props*/) => ({
								sources: [
									...state.sources.slice(0, idx),
									...state.sources.slice(idx + 1),
								],
								dirty: true,
							}))
						}
					/>
				))}
				<div className="setting-item-control">
					{this.state.dirty && (
						<button
							onClick={async () => {
								await this.props.submit(
									this.state.sources.map(
										(elt) => elt as CalendarSource
									)
								);
								this.setState({ dirty: false });
							}}
							style={{
								backgroundColor: this.state.dirty
									? "var(--interactive-accent)"
									: undefined,
								color: this.state.dirty
									? "var(--text-on-accent)"
									: undefined,
							}}
						>
							{this.state.dirty ? "Save" : "Settings Saved"}
						</button>
					)}
				</div>
			</div>
		);
	}
}
