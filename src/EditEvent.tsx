import * as React from "react";
import { useState } from "react";
import { EventFrontmatter } from "./types";

function makeChangeListener<T>(
	setState: React.Dispatch<React.SetStateAction<T>>,
	fromString: (val: string) => T
): React.ChangeEventHandler<HTMLInputElement> {
	return (e) => setState(fromString(e.target.value));
}

interface DayChoiceProps {
	code: string;
	label: string;
	isSelected: boolean;
	onClick: (code: string) => void;
}
const DayChoice = ({ code, label, isSelected, onClick }: DayChoiceProps) => (
	<button
		type="button"
		style={{
			marginLeft: "0.25rem",
			marginRight: "0.25rem",
			padding: "0",
			backgroundColor: isSelected
				? "var(--interactive-accent)"
				: "var(--interactive-normal)",
			color: isSelected ? "var(--text-on-accent)" : "var(--text-normal)",
			// backgroundColor: isSelected ? "blue" : undefined,
			// color: isSelected ? "white" : "black",
			borderStyle: "solid",
			borderWidth: "1px",
			borderRadius: "50%",
			width: "25px",
			height: "25px",
		}}
		onClick={() => onClick(code)}
	>
		<b>{label[0]}</b>
	</button>
);

const DAY_MAP = {
	U: "Sunday",
	M: "Monday",
	T: "Tuesday",
	W: "Wednesday",
	R: "Thursday",
	F: "Friday",
	S: "Saturday",
};

const DaySelect = ({ onChange }: { onChange: (days: string[]) => void }) => {
	const [selected, setSelectedState] = useState<string[]>([]);
	const setSelected = (newSelected: string[]) => {
		onChange(newSelected);
		setSelectedState(newSelected);
	};
	return (
		<div>
			{Object.entries(DAY_MAP).map(([code, label]) => (
				<DayChoice
					key={code}
					code={code}
					label={label}
					isSelected={selected.includes(code)}
					onClick={() =>
						selected.includes(code)
							? setSelected(selected.filter((c) => c !== code))
							: setSelected([code, ...selected])
					}
				/>
			))}
		</div>
	);
};

interface EditEventProps {
	submit: (frontmatter: EventFrontmatter, path?: string) => Promise<void>;
	initialEvent?: Partial<EventFrontmatter>;
	initialId?: string;
}

export const EditEvent = ({
	initialId,
	initialEvent,
	submit,
}: EditEventProps) => {
	const [date, setDate] = useState(
		(initialEvent?.type === "recurring" && initialEvent.startDate) ||
			(initialEvent?.type === "single" && initialEvent?.date) ||
			""
	);

	let initialStartTime = "";
	let initialEndTime = "";
	if (initialEvent !== undefined && initialEvent.allDay === false) {
		initialStartTime = initialEvent.startTime || "";
		initialEndTime = initialEvent.endTime || "";
	}

	const [startTime, setStartTime] = useState(initialStartTime);
	const [endTime, setEndTime] = useState(initialEndTime);
	const [title, setTitle] = useState(initialEvent?.title || "");
	const [isRecurring, setIsRecurring] = useState(
		initialEvent?.type === "recurring" || false
	);
	const [endDate, setEndDate] = useState("");
	const [daysOfWeek, setDaysOfWeek] = useState<string[]>(
		(initialEvent?.type === "recurring" && initialEvent.daysOfWeek) || []
	);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		await submit({
			...{ title, allDay: false }, // TODO: Support all day events
			...(isRecurring
				? { type: "recurring", daysOfWeek, startTime, endTime }
				: { date, startTime, endTime }),
		});
	};

	return (
		<form onSubmit={handleSubmit}>
			<p>
				<input
					type="text"
					id="title"
					value={title}
					placeholder={"Add title"}
					required
					onChange={makeChangeListener(setTitle, (x) => x)}
				/>
			</p>
			<p>
				<input
					type="date"
					id="date"
					value={date}
					required={!isRecurring}
					onChange={makeChangeListener(setDate, (x) => x)}
				/>
				<input
					type="time"
					id="startTime"
					value={startTime}
					required
					onChange={makeChangeListener(setStartTime, (x) => x)}
				/>
				-
				<input
					type="time"
					id="endTime"
					value={endTime}
					required
					onChange={makeChangeListener(setEndTime, (x) => x)}
				/>
			</p>
			<p>
				<label htmlFor="recurring">Recurring Event </label>
				<input
					id="recurring"
					checked={isRecurring}
					onChange={(e) => setIsRecurring(e.target.checked)}
					type="checkbox"
				/>
			</p>

			{isRecurring && (
				<DaySelect onChange={(days) => setDaysOfWeek(days)} />
			)}

			<p>
				<input type="submit" />
			</p>
		</form>
	);
};