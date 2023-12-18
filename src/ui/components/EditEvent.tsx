import { DateTime } from "luxon";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { CalendarInfo, OFCEvent } from "../../types";
import { RRule, rrulestr } from "rrule";
import { EditEventRecurrence } from "./EditEventRecurrence";

function makeChangeListener<T>(
    setState: React.Dispatch<React.SetStateAction<T>>,
    fromString: (val: string) => T
): React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement> {
    return (e) => setState(fromString(e.target.value));
}

const DAY_MAP = {
    U: RRule.SU.weekday,
    M: RRule.MO.weekday,
    T: RRule.TU.weekday,
    W: RRule.WE.weekday,
    R: RRule.TH.weekday,
    F: RRule.FR.weekday,
    S: RRule.SA.weekday,
};

interface EditEventProps {
    submit: (frontmatter: OFCEvent, calendarIndex: number) => Promise<void>;
    readonly calendars: {
        id: string;
        name: string;
        type: CalendarInfo["type"];
    }[];
    defaultCalendarIndex: number;
    initialEvent?: Partial<OFCEvent>;
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
    const initialDate = initialEvent
        ? initialEvent.type === "single"
            ? initialEvent.date
            : initialEvent.type === "recurring"
            ? initialEvent.startRecur
            : initialEvent.type === "rrule"
            ? initialEvent.startDate
            : ""
        : "";

    const [date, setDate] = useState(initialDate);
    const [endDate, setEndDate] = useState(
        initialEvent && initialEvent.type === "single"
            ? initialEvent.endDate
            : undefined
    );

    let initialStartTime = "";
    let initialEndTime = "";
    if (initialEvent) {
        // @ts-ignore
        const { startTime, endTime } = initialEvent;
        initialStartTime = startTime || "";
        initialEndTime = endTime || "";
    }

    const [startTime, setStartTime] = useState(initialStartTime);
    const [endTime, setEndTime] = useState(initialEndTime);
    const [title, setTitle] = useState(initialEvent?.title || "");
    // const [isRecurring, setIsRecurring] = useState(
    //     initialEvent?.type === "recurring" || false
    // );

    const [isRecurring, setIsRecurring] = useState(
        initialEvent?.type === "rrule" ||
            initialEvent?.type === "recurring" ||
            false
    );

    const parsedDate = initialDate
        ? DateTime.fromFormat(initialDate, "yyyy-MM-dd")
        : DateTime.now();
    console.debug("parsedDate:", parsedDate);

    const [recurringRule, setRecurringRule] = useState(
        (initialEvent?.type === "rrule" &&
            initialEvent?.rrule &&
            rrulestr(initialEvent.rrule)) ||
            new RRule({
                freq: RRule.WEEKLY,
                interval: 1,
                dtstart: DateTime.fromObject({
                    ...parsedDate.toObject(),
                    hour: Number(startTime.slice(0, 2)),
                    minute: Number(startTime.slice(3)),
                }).toJSDate(),
                byweekday:
                    initialEvent?.type === "recurring"
                        ? initialEvent.daysOfWeek?.map(
                              (value) => DAY_MAP[value]
                          )
                        : [parsedDate.weekday - 1],
                until:
                    initialEvent?.type === "recurring" && initialEvent.endRecur
                        ? DateTime.fromISO(initialEvent.endRecur).toJSDate()
                        : undefined,
            })
    );

    const [allDay, setAllDay] = useState(initialEvent?.allDay || false);

    const [calendarIndex, setCalendarIndex] = useState(defaultCalendarIndex);

    const [complete, setComplete] = useState(
        initialEvent?.type === "single" &&
            initialEvent.completed !== null &&
            initialEvent.completed !== undefined
            ? initialEvent.completed
            : false
    );

    const [isTask, setIsTask] = useState(
        initialEvent?.type === "single" &&
            initialEvent.completed !== undefined &&
            initialEvent.completed !== null
    );

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
                    : { allDay: false, startTime: startTime || "", endTime }),
                ...(isRecurring
                    ? {
                          type: "rrule",
                          rrule: recurringRule.toString(),
                          startDate: DateTime.fromJSDate(
                              recurringRule.options.dtstart ?? date
                          ).toISODate(),
                          skipDates: [],
                      }
                    : {
                          type: "single",
                          date: date || "",
                          endDate: endDate || null,
                          completed: isTask ? complete : null,
                      }),
            },
            calendarIndex
        );
    };

    return (
        <>
            <div>
                <p style={{ float: "right" }}>
                    {open && <button onClick={open}>Open Note</button>}
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div>
                    <p>
                        <input
                            ref={titleRef}
                            type="text"
                            id="title"
                            value={title}
                            placeholder={"Add title"}
                            required
                            onChange={makeChangeListener(setTitle, (x) => x)}
                        />
                    </p>
                    <p>
                        <select
                            id="calendar"
                            value={calendarIndex}
                            onChange={makeChangeListener(
                                setCalendarIndex,
                                parseInt
                            )}
                        >
                            {calendars
                                .flatMap((cal) =>
                                    cal.type === "local" ||
                                    cal.type === "dailynote"
                                        ? [cal]
                                        : []
                                )
                                .map((cal, idx) => (
                                    <option
                                        key={idx}
                                        value={idx}
                                        disabled={
                                            !(
                                                initialEvent?.title ===
                                                    undefined ||
                                                calendars[calendarIndex]
                                                    .type === cal.type
                                            )
                                        }
                                    >
                                        {cal.type === "local"
                                            ? cal.name
                                            : "Daily Note"}
                                    </option>
                                ))}
                        </select>
                    </p>
                    <p>
                        {!isRecurring && (
                            <input
                                type="date"
                                id="date"
                                value={date}
                                required={!isRecurring}
                                // @ts-ignore
                                onChange={makeChangeListener(setDate, (x) => x)}
                            />
                        )}

                        {allDay ? (
                            <></>
                        ) : (
                            <>
                                <input
                                    type="time"
                                    id="startTime"
                                    value={startTime}
                                    required
                                    onChange={makeChangeListener(
                                        setStartTime,
                                        (x) => x
                                    )}
                                />
                                -
                                <input
                                    type="time"
                                    id="endTime"
                                    value={endTime}
                                    required
                                    onChange={makeChangeListener(
                                        setEndTime,
                                        (x) => x
                                    )}
                                />
                            </>
                        )}
                    </p>
                    <p>
                        <label htmlFor="allDay">All day event </label>
                        <input
                            id="allDay"
                            checked={allDay}
                            onChange={(e) => setAllDay(e.target.checked)}
                            type="checkbox"
                        />
                    </p>

                    <p>
                        <label htmlFor="advanced-recurring">Repeats </label>
                        <input
                            id="advancedRecurring"
                            checked={isRecurring}
                            onChange={(e) => {
                                setIsRecurring(e.target.checked);
                            }}
                            type="checkbox"
                        />
                    </p>

                    {isRecurring && (
                        <EditEventRecurrence
                            recurrence={recurringRule}
                            startTime={startTime}
                            startDate={date}
                            onChange={setRecurringRule}
                        />
                    )}

                    <p>
                        <label htmlFor="task">Task Event </label>
                        <input
                            id="task"
                            checked={isTask}
                            onChange={(e) => {
                                setIsTask(e.target.checked);
                            }}
                            type="checkbox"
                        />
                    </p>

                    {isTask && (
                        <>
                            <label htmlFor="taskStatus">Complete? </label>
                            <input
                                id="taskStatus"
                                checked={
                                    !(
                                        complete === false ||
                                        complete === undefined
                                    )
                                }
                                onChange={(e) =>
                                    setComplete(
                                        e.target.checked
                                            ? DateTime.now().toISO()
                                            : false
                                    )
                                }
                                type="checkbox"
                            />
                        </>
                    )}
                </div>

                <p
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                    }}
                >
                    <button type="submit"> Save Event </button>
                    <span>
                        {deleteEvent && (
                            <button
                                type="button"
                                style={{
                                    backgroundColor:
                                        "var(--interactive-normal)",
                                    color: "var(--background-modifier-error)",
                                    borderColor:
                                        "var(--background-modifier-error)",
                                    borderWidth: "1px",
                                    borderStyle: "solid",
                                }}
                                onClick={deleteEvent}
                            >
                                Delete Event
                            </button>
                        )}
                    </span>
                </p>
            </form>
        </>
    );
};
