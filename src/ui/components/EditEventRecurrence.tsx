import { RRule, Weekday, datetime, ByWeekday, Options } from "rrule";
import * as React from "react";
import { useCallback, useState } from "react";
import { DateTime } from "luxon";
import { RECURRENCE_INFO_MAP, getDateStats } from "./event-recurrence-types";

interface EditEventRecurrenceProps {
    recurrence?: RRule;
    startTime?: string;
    startDate?: string;
    onChange?: (recurrence: RRule) => void;
}

const ALL_FREQUENCIES = [
    RRule.DAILY,
    RRule.WEEKLY,
    RRule.MONTHLY,
    RRule.YEARLY,
];

const FREQ_MAP: { [key: number]: string } = {
    [RRule.DAILY]: "Day(s)",
    [RRule.WEEKLY]: "Week(s)",
    [RRule.MONTHLY]: "Month(s)",
    [RRule.YEARLY]: "Year(s)",
};

const convertWeekday = (day: ByWeekday) => {
    if (typeof day === "string") {
        return Weekday.fromStr(day).weekday;
    }

    if (Number.isNumber(day)) {
        return day;
    }

    return day.weekday;
};

export const EditEventRecurrence = ({
    recurrence,
    startTime,
    startDate,
    onChange,
}: EditEventRecurrenceProps) => {
    const splitStartTime = (startTime ?? "00:00").split(":");
    const startHour = splitStartTime[0];
    const startMinute = splitStartTime[1];

    const currentDate = DateTime.now();

    const defaultStartDate = DateTime.fromJSDate(
        startDate
            ? datetime(
                  Number(startDate.slice(0, 4)),
                  Number(startDate.slice(5, 7)),
                  Number(startDate.slice(8))
              )
            : datetime(currentDate.year, currentDate.month, currentDate.day)
    ).toUTC();

    const options =
        recurrence?.origOptions &&
        "freq" in recurrence.origOptions &&
        "interval" in recurrence.origOptions
            ? recurrence.origOptions
            : ({
                  freq: RRule.WEEKLY,
                  interval: 1,
                  dtstart: defaultStartDate.toJSDate(),
                  byweekday: [defaultStartDate.weekday - 1],
              } as Options);

    console.debug("original:", recurrence?.origOptions);

    const currentStartDate = options.dtstart
        ? DateTime.fromJSDate(options.dtstart).toUTC()
        : defaultStartDate;

    const [defaultInterval, setDefaultInterval] = useState(
        options.interval ?? 1
    );
    const [defaultEndCount, setDefaultEndCount] = useState(options.count ?? 1);
    const [defaultEndDate, setDefaultEndDate] = useState(
        options.until ??
            options.dtstart ??
            DateTime.fromISO(startDate ?? DateTime.now().toISODate())
                .toUTC()
                .toJSDate()
    );

    let defaultExtraProps: Partial<Options> = {};
    if ((options.freq ?? RRule.WEEKLY) in RECURRENCE_INFO_MAP) {
        const recurrenceInfo =
            RECURRENCE_INFO_MAP[options.freq ?? RRule.MONTHLY];

        const currentRecurrenceInfo = recurrenceInfo.find((info) =>
            info.hasProps(options)
        );

        if (currentRecurrenceInfo) {
            defaultExtraProps = currentRecurrenceInfo.filterProps(options);
        }
    }

    const [currentExtraProps, setCurrentExtraProps] =
        useState(defaultExtraProps);

    const [endType, setEndType] = useState(
        recurrence?.options.until
            ? "endDate"
            : recurrence?.options.count
            ? "endCount"
            : "endNever"
    );

    const currentEndDate = DateTime.fromJSDate(
        options.until ?? defaultEndDate ?? options.dtstart ?? new Date()
    );

    const handleChange = useCallback(
        (
            updatedOptions: Partial<Options>,
            includeExtra: boolean = true,
            updatedEndType?: string
        ) => {
            const freq = updatedOptions.freq ?? options.freq;
            const interval = options.interval;
            const dtstart = options.dtstart;
            let otherOptions: Partial<Options> = {};

            console.debug("Other:", otherOptions);
            console.debug("Updated:", updatedOptions);
            console.debug("Include Extra", includeExtra);

            if ((updatedEndType ?? endType) === "endDate") {
                otherOptions.until = currentEndDate.toJSDate();
            } else if ((updatedEndType ?? endType) === "endCount") {
                otherOptions.count = updatedOptions.count ?? options.count;
            }

            if (freq === RRule.WEEKLY) {
                otherOptions.byweekday =
                    updatedOptions.byweekday ?? options.byweekday;
            }

            if (includeExtra) {
                otherOptions = {
                    ...otherOptions,
                    ...currentExtraProps,
                };
            }

            const newProps = {
                freq,
                interval,
                dtstart,
                ...otherOptions,
                ...updatedOptions,
            };

            console.debug("newProps", newProps);

            onChange?.(new RRule(newProps));
        },
        [onChange, options, endType, currentEndDate, currentExtraProps]
    );

    return (
        <>
            <p className="fc-recurring-control">
                Every
                <input
                    id="recurrenceInterval"
                    value={defaultInterval}
                    className="fc-edit-control"
                    onChange={(element) => {
                        const interval = Number(element.target.value);
                        setDefaultInterval(interval);
                        handleChange({
                            interval,
                        });
                    }}
                />
                <select
                    id="recurrenceFrequency"
                    value={options.freq}
                    onChange={(element) => {
                        const newFreq = Number(element.target.value);

                        let extra: Partial<Options> = {};
                        if ((newFreq ?? RRule.WEEKLY) in RECURRENCE_INFO_MAP) {
                            const recurrenceInfo =
                                RECURRENCE_INFO_MAP[newFreq ?? RRule.MONTHLY];

                            const currentRecurrenceInfo = recurrenceInfo[0];

                            if (currentRecurrenceInfo) {
                                extra = currentRecurrenceInfo.getProps(
                                    getDateStats(currentStartDate)
                                );
                            }

                            console.debug("extra updated:", extra);
                        }

                        setCurrentExtraProps(extra);

                        handleChange(
                            {
                                freq: newFreq,
                                ...extra,
                            },
                            false
                        );
                    }}
                >
                    {Object.keys(FREQ_MAP).map((currFrequency) => (
                        <option key={currFrequency} value={currFrequency}>
                            {FREQ_MAP[+currFrequency]}
                        </option>
                    ))}
                </select>
            </p>
            {options.freq === RRule.WEEKLY && (
                <DaySelect
                    value={
                        Array.isArray(options.byweekday)
                            ? options.byweekday.map(convertWeekday)
                            : options.byweekday !== null &&
                              options.byweekday !== undefined
                            ? [convertWeekday(options.byweekday)]
                            : []
                    }
                    onChange={(days) => {
                        handleChange({
                            byweekday: days,
                        });
                    }}
                />
            )}
            {(options.freq === RRule.MONTHLY ||
                options.freq === RRule.YEARLY) && (
                <MonthYearSelect
                    startDate={currentStartDate}
                    options={options}
                    onChange={(options) => {
                        setCurrentExtraProps(options);
                        handleChange(options, false);
                    }}
                />
            )}
            <p className="fc-recurring-control">
                <label htmlFor="recurrenceStartDate">Starting on:</label>
                <input
                    id="recurrenceStartDate"
                    type="date"
                    value={currentStartDate.toUTC().toISODate()}
                    required
                    className="fc-edit-control"
                    onChange={(element) => {
                        handleChange({
                            dtstart: DateTime.fromISO(element.target.value)
                                .toUTC()
                                .set({
                                    hour: Number(startHour),
                                    minute: Number(startMinute),
                                    second: 0,
                                })
                                .toJSDate(),
                        });
                    }}
                />
            </p>
            <p className="fc-recurring-control">Ending:</p>
            <p className="fc-recurring-control">
                <input
                    id="recurrenceEndNeverType"
                    type="radio"
                    name="recurrenceEndType"
                    value="endNever"
                    defaultChecked={endType === "endNever"}
                    onClick={() => {
                        setEndType("endNever");
                        handleChange({}, true, "endNever");
                    }}
                />
                <label htmlFor="recurrenceEndNeverType">never</label>
            </p>
            <p className="fc-recurring-control">
                <input
                    id="recurrenceEndDateType"
                    type="radio"
                    name="recurrenceEndType"
                    value="endDate"
                    defaultChecked={endType === "endDate"}
                    onClick={() => {
                        setEndType("endDate");
                        handleChange({});
                    }}
                />
                <label htmlFor="recurrenceEndDateType">on</label>
                <input
                    id="recurrenceEndDate"
                    type="date"
                    value={currentEndDate.toUTC().toISODate()}
                    className="fc-edit-control"
                    disabled={endType !== "endDate"}
                    onChange={(element) => {
                        const value = DateTime.fromISO(
                            element.target.value
                        ).toUTC();
                        setDefaultEndDate(value.toJSDate());
                        handleChange(
                            {
                                until: value.toJSDate(),
                            },
                            true,
                            "endDate"
                        );
                    }}
                />
            </p>
            <p className="fc-recurring-control">
                <input
                    id="recurrenceEndCountType"
                    type="radio"
                    name="recurrenceEndType"
                    value="endCount"
                    defaultChecked={endType === "endCount"}
                    onClick={() => {
                        setEndType("endCount");
                        handleChange({}, true, "endCount");
                    }}
                />
                <label htmlFor="recurrenceEndCountType">after</label>
                <input
                    id="recurrenceEndCount"
                    value={options.count ?? defaultEndCount}
                    onChange={(element) => {
                        const value = Number(element.target.value);
                        setDefaultEndCount(value);
                        handleChange({
                            count: value,
                        });
                    }}
                    className="fc-edit-control"
                    disabled={endType !== "endCount"}
                />
                <label htmlFor="recurrenceEndCount">occurrence(s)</label>
            </p>
        </>
    );
};

interface DayChoiceProps {
    code: number;
    label: string;
    isSelected: boolean;
    onClick: (code: number) => void;
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

const DAYS_OF_WEEK = [
    RRule.SU,
    RRule.MO,
    RRule.TU,
    RRule.WE,
    RRule.TH,
    RRule.FR,
    RRule.SA,
];

const DaySelect = ({
    value,
    onChange,
}: {
    value: number[];
    onChange: (days: number[]) => void;
}) => {
    return (
        <div className="fc-recurring-control">
            {DAYS_OF_WEEK.map((day) => {
                const code = day.weekday;
                return (
                    <DayChoice
                        key={code}
                        code={code}
                        label={day.toString()}
                        isSelected={value.includes(code)}
                        onClick={() => {
                            console.debug("Day Switched:", value, code);
                            value.includes(code)
                                ? onChange(value.filter((c) => c !== code))
                                : onChange([code, ...value]);
                        }}
                    />
                );
            })}
        </div>
    );
};

interface MonthSelectProps {
    startDate: DateTime;
    options: Partial<Options>;
    onChange: (options: Partial<Options>) => void;
}

const MonthYearSelect = ({
    startDate,
    options,
    onChange,
}: MonthSelectProps) => {
    const dateStats = getDateStats(startDate);

    const recurrenceInfo = RECURRENCE_INFO_MAP[options.freq ?? RRule.MONTHLY];

    const currentRecurrenceInfo =
        recurrenceInfo.find((info) => info.hasProps(options)) ??
        recurrenceInfo[0];

    return (
        <p>
            <select
                id="recurrenceMonthlyType"
                className="fc-recurring-control"
                value={currentRecurrenceInfo.recurrenceType}
                onChange={(element) => {
                    const selectedMonthYearType = Number(element.target.value);

                    const nextRecurrenceInfo = recurrenceInfo.find(
                        (info) => info.recurrenceType === selectedMonthYearType
                    );

                    if (nextRecurrenceInfo) {
                        onChange(nextRecurrenceInfo.getProps(dateStats));
                    }
                }}
            >
                {recurrenceInfo.map((info) => (
                    <option
                        key={info.recurrenceType}
                        value={info.recurrenceType}
                    >
                        {info.getDisplay(dateStats)}
                    </option>
                ))}
            </select>
        </p>
    );
};
