import { DateTime } from "luxon";
import { Options, RRule } from "rrule";

/**
 * This file declares the different types of recurrence supported by
 * this plugin, specifically for Monthly and Yearly recurrences.
 */

/**
 * This enum lists all of the possible types of recurrence, both for
 * monthly and yearly recurrence.
 */
export enum MonthYearRecurrenceType {
    dayOfMonth = 0,
    dayBeforeEndOfMonth = 1,
    weekdayInMonth = 2,
    weekdayBeforeEndOfMonth = 3,
    dayOfYear = 4,
    dayBeforeEndOfYear = 5,
    weekdayInYear = 6,
    weekdayBeforeEndOfYear = 7,
}

/**
 * An interface with the results from the getDateStats function. Contains
 * any information that will be needed to calculate values for monthly or
 * yearly recurrence.
 */
export interface DateStats {
    monthDay: number;
    weekday: number;
    daysUntilEndMonth: number;
    weekdayInMonth: number;
    weekdaysFromMonthEnd: number;
    dayName: string;
    month: number;
    monthName: string;
    yearDay: number;
    daysUntilEndYear: number;
    weekdayInYear: number;
    weekdaysFromYearEnd: number;
}

/**
 * Computes various values to be used in the recurrence rules for monthly
 * or yearly recurrences.
 *
 * @param {DateTime} date - The date for which to compute statistics.
 * @returns {DateStats} - Values related to the date, useful for computing
 * recurrences.
 */
export const getDateStats = (date: DateTime): DateStats => {
    const monthDay = Number(date.day);
    const daysInMonth = date.daysInMonth;
    const yearDay = date.ordinal;
    const daysInYear = date.daysInYear;

    return {
        monthDay,
        weekday: date.weekday - 1,
        daysUntilEndMonth: daysInMonth - monthDay + 1,
        weekdayInMonth: Math.floor((monthDay - 1) / 7) + 1,
        weekdaysFromMonthEnd: Math.floor((daysInMonth - monthDay) / 7) + 1,
        dayName: date.weekdayLong,
        month: date.month,
        monthName: date.monthLong,
        yearDay,
        daysUntilEndYear: daysInYear - yearDay + 1,
        weekdayInYear: Math.floor((yearDay - 1) / 7) + 1,
        weekdaysFromYearEnd: Math.floor((daysInYear - yearDay) / 7) + 1,
    };
};

/**
 * Formats the value as an ordinal. For example, 1 becomes '1st', 2 becomes
 * '2nd', etc.
 * @param {number} value - The value to be turned into an ordianl
 * @returns {string} - The number as an ordinal.
 */
export const formatOrdinalNumber = (value: number): string => {
    const tensValue = value % 100;
    const isBetween10And20 = tensValue > 10 && tensValue < 20;
    const onesDigit = value % 10;
    if (onesDigit === 1 && !isBetween10And20) {
        return `${value}st`;
    }

    if (onesDigit === 2 && !isBetween10And20) {
        return `${value}nd`;
    }

    if (onesDigit === 3 && !isBetween10And20) {
        return `${value}rd`;
    }

    return `${value}th`;
};

/**
 * Formats the argument value as an ordinal, including the string 'to last'
 * at the end. If the argument is 1, then the string 'last' will be
 * returned.
 *
 * Used to format a number as an ordinal relative to the end of a time
 * period (for example, the 2nd to last Friday of the month).
 * @param {number} value - The value to be converted into an ordinal
 * @returns {string} - The display string of an ordinal relative to the end
 * of a time period.
 */
export const formatLastOrdinalNumber = (value: number): string => {
    if (value === 1) {
        return "last";
    }

    return `${formatOrdinalNumber(value)} to last`;
};

/**
 * A RecurrenceInfo declares all of the necessary functionality to
 * calculate/display different recurrence types in the Month/Year select
 * box.
 */
export interface RecurrenceInfo {
    /**
     * The type of recurrence declared by this RecurrenceInfo. The rest of
     * the properties in this interface provide the necessary functionality
     * to support this type of recurrence.
     */
    recurrenceType: MonthYearRecurrenceType;

    /**
     * Returns a boolean declaring whether the passed-in RRule options
     * contain all of the properties necessary for this recurrence type.
     *
     * Used to correctly display a selected recurrence type in the view on
     * initialization.
     *
     * @param {Partial<Options>} options - The current options selected for
     * the current recurrence.
     * @returns {boolean} - True if the current options contain all the
     * information needed for this recurrence type, false otherwise.
     */
    hasProps: (options: Partial<Options>) => boolean;

    /**
     * Given the date stats for a certain date, this function will provide
     * the RRule options necessary for this recurrence type.
     *
     * Used to provide the correct options for this recurrence type when
     * the user selects it in the Month/Year select box.
     *
     * @param {DateStats} dateStats - The result of the getDateStats
     * function for the necessary date.
     * @returns {Partial<Options>} - The RRule options needed for this
     * recurrence type.
     */
    getProps: (dateStats: DateStats) => Partial<Options>;

    /**
     * Given a set of RRule options, this will return RRule options only
     * including the ones needed for this recurrence type.
     *
     * Used when initializing the EditEventRecurrence component to the
     * correct values for the current selected recurrence type.
     *
     * @param {Partial<Options>} options - The RRule options provided in the
     * props to the EditEventRecurrence component.
     * @returns {Partial<Options>} - The provided RRule options, only
     * including the properties necessary for this recurrence type.
     */
    filterProps: (options: Partial<Options>) => Partial<Options>;

    /**
     * Formats the display for this recurrence type.
     *
     * Used for the value displayed in the Month/Yearly recurrence select
     * box.
     *
     * @param {DateStats} dateStats - The result of the getDateStats
     * function for the necessary date.
     * @returns {string} - The display string for this recurrence type.
     */
    getDisplay: (dateStats: DateStats) => string;
}

/**
 * The supported recurrences for monthly recurrence. This array can be
 * updated if we need to support any additional monthly recurrence types in
 * the future.
 */
export const MONTH_RECURRENCE_INFO: RecurrenceInfo[] = [
    {
        recurrenceType: MonthYearRecurrenceType.dayOfMonth,
        hasProps: (options) => {
            if (!options.bymonthday) {
                return false;
            }

            const bymonthday = Array.isArray(options.bymonthday)
                ? options.bymonthday[0]
                : options.bymonthday;

            return bymonthday > 0;
        },
        getProps: (dateStats) => ({
            bymonthday: [dateStats.monthDay],
        }),
        filterProps: (options) => ({
            bymonthday: options.bymonthday,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatOrdinalNumber(
                dateStats.monthDay
            )} day of the month`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.dayBeforeEndOfMonth,
        hasProps: (options) => {
            if (!options.bymonthday) {
                return false;
            }

            const bymonthday = Array.isArray(options.bymonthday)
                ? options.bymonthday[0]
                : options.bymonthday;

            return bymonthday < 0;
        },
        getProps: (dateStats) => ({
            bymonthday: [dateStats.daysUntilEndMonth * -1],
        }),
        filterProps: (options) => ({
            bymonthday: options.bymonthday,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatLastOrdinalNumber(
                dateStats.daysUntilEndMonth
            )} day of the month`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.weekdayInMonth,
        hasProps: (options) => {
            if (!options.bysetpos || !options.byweekday) {
                return false;
            }

            const bysetpos = Array.isArray(options.bysetpos)
                ? options.bysetpos[0]
                : options.bysetpos;

            return bysetpos > 0;
        },
        getProps: (dateStats) => ({
            bysetpos: [dateStats.weekdayInMonth],
            byweekday: [dateStats.weekday],
        }),
        filterProps: (options) => ({
            bysetpos: options.bysetpos,
            byweekday: options.byweekday,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatOrdinalNumber(dateStats.weekdayInMonth)} ${
                dateStats.dayName
            } of the month`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.weekdayBeforeEndOfMonth,
        hasProps: (options) => {
            if (!options.bysetpos || !options.byweekday) {
                return false;
            }

            const bysetpos = Array.isArray(options.bysetpos)
                ? options.bysetpos[0]
                : options.bysetpos;

            return bysetpos < 0;
        },
        getProps: (dateStats) => ({
            bysetpos: [dateStats.weekdaysFromMonthEnd * -1],
            byweekday: [dateStats.weekday],
        }),
        filterProps: (options) => ({
            bysetpos: options.bysetpos,
            byweekday: options.byweekday,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatLastOrdinalNumber(
                dateStats.weekdaysFromMonthEnd
            )} ${dateStats.dayName} of the month`,
    },
];

/**
 * The supported recurrences for yearly recurrence. This array can be
 * updated if we need to support any additional monthly recurrence types in
 * the future.
 */
export const YEAR_RECURRENCE_INFO: RecurrenceInfo[] = [
    {
        recurrenceType: MonthYearRecurrenceType.dayOfMonth,
        hasProps: (options) => {
            if (!options.bymonthday || !options.bymonth) {
                return false;
            }

            const bymonthday = Array.isArray(options.bymonthday)
                ? options.bymonthday[0]
                : options.bymonthday;

            return bymonthday > 0;
        },
        getProps: (dateStats) => ({
            bymonthday: [dateStats.monthDay],
            bymonth: [dateStats.month],
        }),
        filterProps: (options) => ({
            bymonthday: options.bymonthday,
            bymonth: options.bymonth,
        }),
        getDisplay: (dateStats) =>
            `on ${dateStats.monthName} ${formatOrdinalNumber(
                dateStats.monthDay
            )}`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.dayBeforeEndOfMonth,
        hasProps: (options) => {
            if (!options.bymonthday || !options.bymonth) {
                return false;
            }

            const bymonthday = Array.isArray(options.bymonthday)
                ? options.bymonthday[0]
                : options.bymonthday;

            return bymonthday < 0;
        },
        getProps: (dateStats) => ({
            bymonthday: [dateStats.daysUntilEndMonth * -1],
            bymonth: [dateStats.month],
        }),
        filterProps: (options) => ({
            bymonthday: options.bymonthday,
            bymonth: options.bymonth,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatLastOrdinalNumber(
                dateStats.daysUntilEndMonth
            )} day of ${dateStats.monthName}`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.weekdayInMonth,
        hasProps: (options) => {
            if (!options.bysetpos || !options.byweekday || !options.bymonth) {
                return false;
            }

            const bysetpos = Array.isArray(options.bysetpos)
                ? options.bysetpos[0]
                : options.bysetpos;

            return bysetpos > 0;
        },
        getProps: (dateStats) => ({
            bysetpos: [dateStats.weekdayInMonth],
            byweekday: [dateStats.weekday],
            bymonth: [dateStats.month],
        }),
        filterProps: (options) => ({
            bysetpos: options.bysetpos,
            byweekday: options.byweekday,
            bymonth: options.bymonth,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatOrdinalNumber(dateStats.weekdayInMonth)} ${
                dateStats.dayName
            } of ${dateStats.monthName}`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.weekdayBeforeEndOfMonth,
        hasProps: (options) => {
            if (!options.bysetpos || !options.byweekday || !options.bymonth) {
                return false;
            }

            const bysetpos = Array.isArray(options.bysetpos)
                ? options.bysetpos[0]
                : options.bysetpos;

            return bysetpos < 0;
        },
        getProps: (dateStats) => ({
            bysetpos: [dateStats.weekdaysFromMonthEnd * -1],
            byweekday: [dateStats.weekday],
            bymonth: [dateStats.month],
        }),
        filterProps: (options) => ({
            bysetpos: options.bysetpos,
            byweekday: options.byweekday,
            bymonth: options.bymonth,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatLastOrdinalNumber(
                dateStats.weekdaysFromMonthEnd
            )} ${dateStats.dayName} of ${dateStats.monthName}`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.dayOfYear,
        hasProps: (options) => {
            if (!options.byyearday) {
                return false;
            }

            const byyearday = Array.isArray(options.byyearday)
                ? options.byyearday[0]
                : options.byyearday;

            return byyearday > 0;
        },
        getProps: (dateStats) => ({
            byyearday: [dateStats.yearDay],
        }),
        filterProps: (options) => ({
            byyearday: options.byyearday,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatOrdinalNumber(dateStats.yearDay)} day of the year`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.dayBeforeEndOfYear,
        hasProps: (options) => {
            if (!options.byyearday) {
                return false;
            }

            const byyearday = Array.isArray(options.byyearday)
                ? options.byyearday[0]
                : options.byyearday;

            return byyearday < 0;
        },
        getProps: (dateStats) => ({
            byyearday: [dateStats.daysUntilEndYear * -1],
        }),
        filterProps: (options) => ({
            byyearday: options.byyearday,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatLastOrdinalNumber(
                dateStats.daysUntilEndYear
            )} day of the year`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.weekdayInYear,
        hasProps: (options) => {
            if (!options.bysetpos || !options.byweekday) {
                return false;
            }

            const bysetpos = Array.isArray(options.bysetpos)
                ? options.bysetpos[0]
                : options.bysetpos;

            return bysetpos > 0;
        },
        getProps: (dateStats) => ({
            bysetpos: [dateStats.weekdayInYear],
            byweekday: [dateStats.weekday],
        }),
        filterProps: (options) => ({
            bysetpos: options.bysetpos,
            byweekday: options.byweekday,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatOrdinalNumber(dateStats.weekdayInYear)} ${
                dateStats.dayName
            } of the year`,
    },
    {
        recurrenceType: MonthYearRecurrenceType.weekdayBeforeEndOfYear,
        hasProps: (options) => {
            if (!options.bysetpos || !options.byweekday) {
                return false;
            }

            const bysetpos = Array.isArray(options.bysetpos)
                ? options.bysetpos[0]
                : options.bysetpos;

            return bysetpos < 0;
        },
        getProps: (dateStats) => ({
            bysetpos: [dateStats.weekdaysFromYearEnd * -1],
            byweekday: [dateStats.weekday],
        }),
        filterProps: (options) => ({
            bysetpos: options.bysetpos,
            byweekday: options.byweekday,
        }),
        getDisplay: (dateStats) =>
            `on the ${formatLastOrdinalNumber(dateStats.weekdaysFromYearEnd)} ${
                dateStats.dayName
            } of the year`,
    },
];

export const RECURRENCE_INFO_MAP: { [key: number]: RecurrenceInfo[] } = {
    [RRule.MONTHLY]: MONTH_RECURRENCE_INFO,
    [RRule.YEARLY]: YEAR_RECURRENCE_INFO,
};
