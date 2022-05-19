import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
	CalendarSource,
	EventFrontmatter,
	LocalCalendarSource,
	SingleEventFrontmatter,
} from "../types";

function makeChangeListener<T>(
	setState: React.Dispatch<React.SetStateAction<T>>,
	fromString: (val: string) => T
): React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement> {
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

const DaySelect = ({
	value: days,
	onChange,
	label: selectLabel,
}: {
	value: string[];
	onChange: (days: string[]) => void;
	label: string;
}) => {
	return (
		<>
			<label htmlFor="daysSelect">{selectLabel}</label>
			<div id="daysSelect">
				{Object.entries(DAY_MAP).map(([code, label]) => (
					<DayChoice
						key={code}
						code={code}
						label={label}
						isSelected={days.includes(code)}
						onClick={() =>
							days.includes(code)
								? onChange(days.filter((c) => c !== code))
								: onChange([code, ...days])
						}
					/>
				))}
			</div>
		</>
	);
};

interface EditEventProps {
	submit: (
		frontmatter: EventFrontmatter,
		calendarIndex: number
	) => Promise<void>;
	readonly calendars: CalendarSource[];
	defaultCalendarIndex: number;
	initialEvent?: Partial<EventFrontmatter>;
	open?: () => Promise<void>;
	deleteEvent?: () => Promise<void>;
}

export const EditEvent = ({
	initialEvent,
	submit,
	open,
	deleteEvent,
	calendars,
	defaultCalendarIndex,
}: EditEventProps) => {
	const [date, setDate] = useState(
		initialEvent
			? initialEvent.type !== "recurring"
				? // Discriminated union on unset type not working well within Partial<>
				  (initialEvent as SingleEventFrontmatter).date
				: initialEvent.startRecur || ""
			: ""
	);
	const [endDate, setEndDate] = useState(
		initialEvent && initialEvent.type === "single"
			? initialEvent.endDate
			: undefined
	);

	let initialStartTime = "";
	let initialEndTime = "";
	if (initialEvent && initialEvent.allDay === false) {
		initialStartTime = initialEvent.startTime || "";
		initialEndTime = initialEvent.endTime || "";
	}

	const [startTime, setStartTime] = useState(initialStartTime);
	const [endTime, setEndTime] = useState(initialEndTime);
	const [title, setTitle] = useState(initialEvent?.title || "");
	const [isRecurring, setIsRecurring] = useState(
		initialEvent?.type === "recurring" || false
	);
	const [endRecur, setEndRecur] = useState("");

	const [daysOfWeek, setDaysOfWeek] = useState<string[]>(
		(initialEvent?.type === "recurring" ? initialEvent.daysOfWeek : []) ||
			[]
	);

	const onRecurringDaysChanged = (days: string[]) => {
		setIsRecurring(days.length > 0);
		setDaysOfWeek(days);
	};

	const [allDay, setAllDay] = useState(initialEvent?.allDay || false);

	const [calendarIndex, setCalendarIndex] = useState(defaultCalendarIndex);

	const titleRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (titleRef.current) {
			titleRef.current.focus();
		}
	}, [titleRef]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		await submit(
			{
				...{ title },
				...(allDay
					? { allDay: true }
					: { allDay: false, startTime, endTime }),
				...(isRecurring
					? {
							type: "recurring",
							daysOfWeek,
							startRecur: date || undefined,
							endRecur: endRecur || undefined,
					  }
					: {
							type: "single",
							date,
							endDate,
					  }),
			},
			calendarIndex
		);
	};

	const startTimeInput = (
		<>
			<label htmlFor="startTime">Start Time</label>
			<input
				type="time"
				id="startTime"
				value={startTime}
				required
				onChange={makeChangeListener(setStartTime, (x) => x)}
			/>
		</>
	);

	const endTimeInput = (
		<>
			<label htmlFor="endTime">End Time</label>
			<input
				type="time"
				id="endTime"
				value={endTime}
				required
				onChange={makeChangeListener(setEndTime, (x) => x)}
			/>
		</>
	);

	const startDateInput = (
		<>
			<label htmlFor="date">Start Date</label>
			<input
				type="date"
				id="date"
				value={date}
				required={!isRecurring}
				onChange={makeChangeListener(setDate, (x) => x)}
			/>
		</>
	);

	const endDateInput = (
		<>
			<label htmlFor="endDate">End Date</label>
			<input
				type="date"
				id="endDate"
				value={endDate}
				required={!isRecurring}
				onChange={makeChangeListener(setEndDate, (x) =>
					x == "undefined" ? undefined : x
				)}
			/>
		</>
	);

	const stopRecurringInput = (
		<>
			<label htmlFor="startDate">Stop repeating</label>
			<input
				type="date"
				id="endRecurDate"
				value={endRecur}
				onChange={makeChangeListener(setEndRecur, (x) => x)}
			/>
		</>
	);

	return (
		<>
			<form onSubmit={handleSubmit} className="ofc-edit-modal-content">
				<div
					className="ofc-edit-modal-column"
					style={{ gridColumn: "span 2" }}
				>
					<label htmlFor="title">Event title</label>
					<input
						ref={titleRef}
						className="ofc-edit-modal-event-title"
						type="text"
						id="title"
						value={title}
						placeholder={"Add title"}
						required
						onChange={makeChangeListener(setTitle, (x) => x)}
					/>
				</div>
				<div
					className="ofc-edit-modal-column"
					style={{ gridColumn: "span 2" }}
				>
					<label htmlFor="calendar">Calendar</label>
					<select
						id="calendar"
						value={calendarIndex}
						className={"ofc-edit-modal-event-calendar"}
						onChange={makeChangeListener(
							setCalendarIndex,
							parseInt
						)}
					>
						{calendars
							.filter((cal) => cal.type === "local")
							.map((cal, idx) => (
								<option key={idx} value={idx}>
									{(cal as LocalCalendarSource).directory}
								</option>
							))}
					</select>
				</div>
				<div className="ofc-edit-modal-column">{startDateInput}</div>
				<div className="ofc-edit-modal-column">
					{!isRecurring && endDateInput}
				</div>
				<div className="ofc-edit-modal-checkbox">
					<input
						id="allDay"
						checked={allDay}
						onChange={(e) => setAllDay(e.target.checked)}
						type="checkbox"
					/>
					<label htmlFor="allDay">All day event </label>
				</div>
				<div className="ofc-edit-modal-checkbox">
					<input
						id="recurring"
						checked={isRecurring}
						onChange={(e) => setIsRecurring(e.target.checked)}
						type="checkbox"
					/>
					<label htmlFor="recurring">Recurring event </label>
				</div>
				{!allDay && (
					<>
						<div className="ofc-edit-modal-column">
							{startTimeInput}
						</div>
						<div className="ofc-edit-modal-column">
							{endTimeInput}
						</div>
					</>
				)}
				{isRecurring && (
					<>
						<div className="ofc-edit-modal-column">
							<DaySelect
								label="Repeat On"
								value={daysOfWeek}
								onChange={onRecurringDaysChanged}
							/>
						</div>
						<div className="ofc-edit-modal-column">
							{stopRecurringInput}
						</div>
					</>
				)}

				<div
					className="ofc-edit-modal-buttons"
					style={{ gridColumn: "span 2" }}
				>
					{deleteEvent && (
						<button
							type="button"
							className="ofc-edit-modal-event-delete-button"
							onClick={deleteEvent}
						>
							Delete Event
						</button>
					)}
					<button
						className="ofc-edit-modal-event-open-button"
						onClick={open}
						disabled={!open}
					>
						Open Note
					</button>
					<button
						className="ofc-edit-modal-event-save-button"
						type="submit"
					>
						{" "}
						Save Event{" "}
					</button>
				</div>
			</form>
		</>
	);
};
