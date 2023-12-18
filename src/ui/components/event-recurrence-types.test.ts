import { Options, RRule } from "rrule";
import { DateTime } from "luxon";
import {
    DateStats,
    MONTH_RECURRENCE_INFO,
    MonthYearRecurrenceType,
    RecurrenceInfo,
    YEAR_RECURRENCE_INFO,
    formatOrdinalNumber,
    getDateStats,
} from "./event-recurrence-types";

describe("Recurrence Info", () => {
    let currentInfo: RecurrenceInfo;
    let options: Partial<Options> = {
        freq: RRule.DAILY,
        dtstart: new Date(),
        interval: 1,
        wkst: RRule.SU,
        count: 1,
        until: new Date(),
        tzid: "UTC",
        bysetpos: [1],
        bymonth: [1],
        bymonthday: [2],
        bynmonthday: [3],
        byyearday: [20],
        byweekno: [1],
        byweekday: [RRule.WE],
        bynweekday: [[1]],
        byhour: [2],
        byminute: [42],
        bysecond: [21],
        byeaster: 1,
    };

    let dateStats: DateStats;

    let hasPropsResult: boolean;
    let optionsResult: Partial<Options>;
    let displayResult: string;

    let getRecurrenceInfo: (type: MonthYearRecurrenceType) => void;

    const actHasProps = () => {
        hasPropsResult = currentInfo.hasProps(options);
    };

    const actGetProps = () => {
        optionsResult = currentInfo.getProps(dateStats);
    };

    const actFilterProps = () => {
        optionsResult = currentInfo.filterProps(options);
    };

    const actGetDisplay = () => {
        displayResult = currentInfo.getDisplay(dateStats);
    };

    describe("MONTH_RECURRENCE_INFO", () => {
        beforeEach(() => {
            getRecurrenceInfo = (type) => {
                currentInfo =
                    MONTH_RECURRENCE_INFO.find(
                        (info) => info.recurrenceType === type
                    ) ?? MONTH_RECURRENCE_INFO[0];
            };
        });

        describe("dayOfMonth", () => {
            beforeEach(() => {
                getRecurrenceInfo(MonthYearRecurrenceType.dayOfMonth);
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when day is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [1],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [-1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: 1,
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: -1,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is undefined", () => {
                    beforeEach(() => {
                        options = {};

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is null", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the dateStats month day in the options", () => {
                    expect(optionsResult.bymonthday).toMatchObject([1]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should only return the bymonthday option in the options", () => {
                    expect(Object.keys(optionsResult)).toMatchObject([
                        "bymonthday",
                    ]);
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2023-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 12th day of the month"
                        );
                    });
                });
            });
        });

        describe("dayBeforeEndOfMonth", () => {
            beforeEach(() => {
                getRecurrenceInfo(MonthYearRecurrenceType.dayBeforeEndOfMonth);
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when day is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [-1],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: 1,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: -1,
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is undefined", () => {
                    beforeEach(() => {
                        options = {};

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is null", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the dateStats daysBeforeEnd in the options", () => {
                    expect(optionsResult.bymonthday).toMatchObject([-30]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should only return the bymonthday option in the options", () => {
                    expect(Object.keys(optionsResult)).toMatchObject([
                        "bymonthday",
                    ]);
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2023-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 19th to last day of the month"
                        );
                    });
                });
            });
        });

        describe("weekdayInMonth", () => {
            beforeEach(() => {
                getRecurrenceInfo(MonthYearRecurrenceType.weekdayInMonth);
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when bysetpos is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [-1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: 1,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: -1,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is undefined", () => {
                    beforeEach(() => {
                        options = {
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: null,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the weekdayInMonth in the options", () => {
                    expect(optionsResult.bysetpos).toMatchObject([
                        dateStats.weekdayInMonth,
                    ]);
                });

                it("should put the weekday in the options", () => {
                    expect(optionsResult.byweekday).toMatchObject([
                        dateStats.weekday,
                    ]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should only return two keys in the options", () => {
                    expect(Object.keys(optionsResult)).toHaveLength(2);
                });

                it("should return options that contain bysetpos", () => {
                    expect(Object.keys(optionsResult)).toContain("bysetpos");
                });

                it("should return options that contain byweekday", () => {
                    expect(Object.keys(optionsResult)).toContain("byweekday");
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2023-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 2nd Tuesday of the month"
                        );
                    });
                });
            });
        });

        describe("weekdayBeforeEndOfMonth", () => {
            beforeEach(() => {
                getRecurrenceInfo(
                    MonthYearRecurrenceType.weekdayBeforeEndOfMonth
                );
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when bysetpos is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [-1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: 1,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: -1,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is undefined", () => {
                    beforeEach(() => {
                        options = {
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: null,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the weekdaysFromMonthEnd in the options", () => {
                    expect(optionsResult.bysetpos).toMatchObject([
                        dateStats.weekdaysFromMonthEnd * -1,
                    ]);
                });

                it("should put the weekday in the options", () => {
                    expect(optionsResult.byweekday).toMatchObject([
                        dateStats.weekday,
                    ]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should only return two keys in the options", () => {
                    expect(Object.keys(optionsResult)).toHaveLength(2);
                });

                it("should return options that contain bysetpos", () => {
                    expect(Object.keys(optionsResult)).toContain("bysetpos");
                });

                it("should return options that contain byweekday", () => {
                    expect(Object.keys(optionsResult)).toContain("byweekday");
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2023-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 3rd to last Tuesday of the month"
                        );
                    });
                });
            });
        });
    });

    describe("YEAR_RECURRENCE_INFO", () => {
        beforeEach(() => {
            getRecurrenceInfo = (type) => {
                currentInfo =
                    YEAR_RECURRENCE_INFO.find(
                        (info) => info.recurrenceType === type
                    ) ?? YEAR_RECURRENCE_INFO[0];
            };
        });

        describe("dayOfMonth", () => {
            beforeEach(() => {
                getRecurrenceInfo(MonthYearRecurrenceType.dayOfMonth);
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when day is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [1],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [-1],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: 1,
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: -1,
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is null", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: null,
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when month is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when month is null", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [1],
                            bymonth: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the dateStats month day in the options", () => {
                    expect(optionsResult.bymonthday).toMatchObject([1]);
                });

                it("should put the dateStats month in the options", () => {
                    expect(optionsResult.bymonth).toMatchObject([9]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should return an options with two properties", () => {
                    expect(Object.keys(optionsResult)).toHaveLength(2);
                });

                it("should return an options with bymonthday", () => {
                    expect(Object.keys(optionsResult)).toContain("bymonthday");
                });

                it("should return an options with bymonth", () => {
                    expect(Object.keys(optionsResult)).toContain("bymonth");
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2023-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe("on September 12th");
                    });
                });
            });
        });

        describe("dayBeforeEndOfMonth", () => {
            beforeEach(() => {
                getRecurrenceInfo(MonthYearRecurrenceType.dayBeforeEndOfMonth);
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when day is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [1],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [-1],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: 1,
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: -1,
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is null", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: null,
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when month is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [-1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when month is null", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: [-1],
                            bymonth: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the dateStats days until end of month in the options", () => {
                    expect(optionsResult.bymonthday).toMatchObject([-30]);
                });

                it("should put the dateStats month in the options", () => {
                    expect(optionsResult.bymonth).toMatchObject([9]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should return an options with two properties", () => {
                    expect(Object.keys(optionsResult)).toHaveLength(2);
                });

                it("should return an options with bymonthday", () => {
                    expect(Object.keys(optionsResult)).toContain("bymonthday");
                });

                it("should return an options with bymonth", () => {
                    expect(Object.keys(optionsResult)).toContain("bymonth");
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2023-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 19th to last day of September"
                        );
                    });
                });
            });
        });

        describe("weekdayInMonth", () => {
            beforeEach(() => {
                getRecurrenceInfo(MonthYearRecurrenceType.weekdayInMonth);
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when bysetpos is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [-1],
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: 1,
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: -1,
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is undefined", () => {
                    beforeEach(() => {
                        options = {
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: null,
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: null,
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when month is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when month is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                            bymonth: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the weekdayInMonth in the options", () => {
                    expect(optionsResult.bysetpos).toMatchObject([
                        dateStats.weekdayInMonth,
                    ]);
                });

                it("should put the weekday in the options", () => {
                    expect(optionsResult.byweekday).toMatchObject([
                        dateStats.weekday,
                    ]);
                });

                it("should put the month in the options", () => {
                    expect(optionsResult.bymonth).toMatchObject([
                        dateStats.month,
                    ]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should only return three keys in the options", () => {
                    expect(Object.keys(optionsResult)).toHaveLength(3);
                });

                it("should return options that contain bysetpos", () => {
                    expect(Object.keys(optionsResult)).toContain("bysetpos");
                });

                it("should return options that contain byweekday", () => {
                    expect(Object.keys(optionsResult)).toContain("byweekday");
                });

                it("should return options that contain bymonth", () => {
                    expect(Object.keys(optionsResult)).toContain("bymonth");
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2023-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 2nd Tuesday of September"
                        );
                    });
                });
            });
        });

        describe("weekdayBeforeEndOfMonth", () => {
            beforeEach(() => {
                getRecurrenceInfo(
                    MonthYearRecurrenceType.weekdayBeforeEndOfMonth
                );
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when bysetpos is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [-1],
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: 1,
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: -1,
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is undefined", () => {
                    beforeEach(() => {
                        options = {
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: null,
                            byweekday: [RRule.MO.weekday],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: null,
                            bymonth: [9],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when month is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when month is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                            bymonth: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the weekdaysFromMonthEnd in the options", () => {
                    expect(optionsResult.bysetpos).toMatchObject([
                        dateStats.weekdaysFromMonthEnd * -1,
                    ]);
                });

                it("should put the weekday in the options", () => {
                    expect(optionsResult.byweekday).toMatchObject([
                        dateStats.weekday,
                    ]);
                });

                it("should put the month in the options", () => {
                    expect(optionsResult.bymonth).toMatchObject([
                        dateStats.month,
                    ]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should only return three keys in the options", () => {
                    expect(Object.keys(optionsResult)).toHaveLength(3);
                });

                it("should return options that contain bysetpos", () => {
                    expect(Object.keys(optionsResult)).toContain("bysetpos");
                });

                it("should return options that contain byweekday", () => {
                    expect(Object.keys(optionsResult)).toContain("byweekday");
                });

                it("should return options that contain bymonth", () => {
                    expect(Object.keys(optionsResult)).toContain("bymonth");
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2023-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 3rd to last Tuesday of September"
                        );
                    });
                });
            });
        });

        describe("dayOfYear", () => {
            beforeEach(() => {
                getRecurrenceInfo(MonthYearRecurrenceType.dayOfYear);
                dateStats = getDateStats(DateTime.fromISO("2023-01-01"));
            });

            describe("hasProps", () => {
                describe("when day is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: [1],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: [-1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: 1,
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: -1,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is undefined", () => {
                    beforeEach(() => {
                        options = {};

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is null", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the dateStats year day in the options", () => {
                    expect(optionsResult.byyearday).toMatchObject([1]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should return an options with the expected property", () => {
                    expect(Object.keys(optionsResult)).toMatchObject([
                        "byyearday",
                    ]);
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2024-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 256th day of the year"
                        );
                    });
                });
            });
        });

        describe("dayBeforeEndOfYear", () => {
            beforeEach(() => {
                getRecurrenceInfo(MonthYearRecurrenceType.dayBeforeEndOfYear);
                dateStats = getDateStats(DateTime.fromISO("2024-01-01"));
            });

            describe("hasProps", () => {
                describe("when day is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: [1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: [-1],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: 1,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: -1,
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when day is undefined", () => {
                    beforeEach(() => {
                        options = {};

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when day is null", () => {
                    beforeEach(() => {
                        options = {
                            byyearday: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the dateStats days until end of year in the options", () => {
                    expect(optionsResult.byyearday).toMatchObject([-366]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should return an options with the expected property", () => {
                    expect(Object.keys(optionsResult)).toMatchObject([
                        "byyearday",
                    ]);
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2024-01-01")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 366th to last day of the year"
                        );
                    });
                });
            });
        });

        describe("weekdayInYear", () => {
            beforeEach(() => {
                getRecurrenceInfo(MonthYearRecurrenceType.weekdayInYear);
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when bysetpos is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [-1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: 1,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bymonthday: -1,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is undefined", () => {
                    beforeEach(() => {
                        options = {
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: null,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the weekdayInYear in the options", () => {
                    expect(optionsResult.bysetpos).toMatchObject([
                        dateStats.weekdayInYear,
                    ]);
                });

                it("should put the weekday in the options", () => {
                    expect(optionsResult.byweekday).toMatchObject([
                        dateStats.weekday,
                    ]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should only return two keys in the options", () => {
                    expect(Object.keys(optionsResult)).toHaveLength(2);
                });

                it("should return options that contain bysetpos", () => {
                    expect(Object.keys(optionsResult)).toContain("bysetpos");
                });

                it("should return options that contain byweekday", () => {
                    expect(Object.keys(optionsResult)).toContain("byweekday");
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2023-09-12")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 37th Tuesday of the year"
                        );
                    });
                });
            });
        });

        describe("weekdayBeforeEndOfYear", () => {
            beforeEach(() => {
                getRecurrenceInfo(
                    MonthYearRecurrenceType.weekdayBeforeEndOfYear
                );
                dateStats = getDateStats(DateTime.fromISO("2023-09-01"));
            });

            describe("hasProps", () => {
                describe("when bysetpos is an array with a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is an array with a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [-1],
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is a positive number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: 1,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is a negative number", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: -1,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return true", () => {
                        expect(hasPropsResult).toBe(true);
                    });
                });

                describe("when bysetpos is undefined", () => {
                    beforeEach(() => {
                        options = {
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when bysetpos is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: null,
                            byweekday: [RRule.MO.weekday],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is undefined", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });

                describe("when weekday is null", () => {
                    beforeEach(() => {
                        options = {
                            bysetpos: [1],
                            byweekday: null,
                        };

                        actHasProps();
                    });

                    it("should return false", () => {
                        expect(hasPropsResult).toBe(false);
                    });
                });
            });

            describe("getProps", () => {
                beforeEach(() => {
                    actGetProps();
                });

                it("should put the weekdaysFromYearEnd in the options", () => {
                    expect(optionsResult.bysetpos).toMatchObject([
                        dateStats.weekdaysFromYearEnd * -1,
                    ]);
                });

                it("should put the weekday in the options", () => {
                    expect(optionsResult.byweekday).toMatchObject([
                        dateStats.weekday,
                    ]);
                });
            });

            describe("filterProps", () => {
                beforeEach(() => {
                    actFilterProps();
                });

                it("should only return two keys in the options", () => {
                    expect(Object.keys(optionsResult)).toHaveLength(2);
                });

                it("should return options that contain bysetpos", () => {
                    expect(Object.keys(optionsResult)).toContain("bysetpos");
                });

                it("should return options that contain byweekday", () => {
                    expect(Object.keys(optionsResult)).toContain("byweekday");
                });
            });

            describe("getDisplay", () => {
                describe("when called with date stats", () => {
                    beforeEach(() => {
                        dateStats = getDateStats(
                            DateTime.fromISO("2024-01-01")
                        );

                        actGetDisplay();
                    });

                    it("should return the expected text", () => {
                        expect(displayResult).toBe(
                            "on the 53rd to last Monday of the year"
                        );
                    });
                });
            });
        });
    });
});

describe("formatOrdinalNumber", () => {
    let value: number;
    let result: string;

    const act = () => {
        result = formatOrdinalNumber(value);
    };

    describe("when value ends in 1", () => {
        describe("when the tens place is zero", () => {
            describe("when the value is 1", () => {
                beforeEach(() => {
                    value = 1;

                    act();
                });

                it("should end in st", () => {
                    expect(result).toBe("1st");
                });
            });

            describe("when the value is 101", () => {
                beforeEach(() => {
                    value = 101;

                    act();
                });

                it("should end in st", () => {
                    expect(result).toBe("101st");
                });
            });
        });

        describe("when the tens place is one", () => {
            describe("when the value is 11", () => {
                beforeEach(() => {
                    value = 11;

                    act();
                });

                it("should end in th", () => {
                    expect(result).toBe("11th");
                });
            });

            describe("when the value is 111", () => {
                beforeEach(() => {
                    value = 111;

                    act();
                });

                it("should end in th", () => {
                    expect(result).toBe("111th");
                });
            });
        });

        describe("when the tens place is two", () => {
            describe("when the value is 21", () => {
                beforeEach(() => {
                    value = 21;

                    act();
                });

                it("should end in st", () => {
                    expect(result).toBe("21st");
                });
            });

            describe("when the value is 121", () => {
                beforeEach(() => {
                    value = 121;

                    act();
                });

                it("should end in st", () => {
                    expect(result).toBe("121st");
                });
            });
        });
    });

    describe("when value ends in 2", () => {
        describe("when the tens place is zero", () => {
            describe("when the value is 2", () => {
                beforeEach(() => {
                    value = 2;

                    act();
                });

                it("should end in nd", () => {
                    expect(result).toBe("2nd");
                });
            });

            describe("when the value is 102", () => {
                beforeEach(() => {
                    value = 102;

                    act();
                });

                it("should end in nd", () => {
                    expect(result).toBe("102nd");
                });
            });
        });

        describe("when the tens place is one", () => {
            describe("when the value is 12", () => {
                beforeEach(() => {
                    value = 12;

                    act();
                });

                it("should end in th", () => {
                    expect(result).toBe("12th");
                });
            });

            describe("when the value is 112", () => {
                beforeEach(() => {
                    value = 112;

                    act();
                });

                it("should end in th", () => {
                    expect(result).toBe("112th");
                });
            });
        });

        describe("when the tens place is two", () => {
            describe("when the value is 22", () => {
                beforeEach(() => {
                    value = 22;

                    act();
                });

                it("should end in nd", () => {
                    expect(result).toBe("22nd");
                });
            });

            describe("when the value is 122", () => {
                beforeEach(() => {
                    value = 122;

                    act();
                });

                it("should end in nd", () => {
                    expect(result).toBe("122nd");
                });
            });
        });
    });

    describe("when value ends in 3", () => {
        describe("when the tens place is zero", () => {
            describe("when the value is 3", () => {
                beforeEach(() => {
                    value = 3;

                    act();
                });

                it("should end in rd", () => {
                    expect(result).toBe("3rd");
                });
            });

            describe("when the value is 103", () => {
                beforeEach(() => {
                    value = 103;

                    act();
                });

                it("should end in rd", () => {
                    expect(result).toBe("103rd");
                });
            });
        });

        describe("when the tens place is one", () => {
            describe("when the value is 13", () => {
                beforeEach(() => {
                    value = 13;

                    act();
                });

                it("should end in th", () => {
                    expect(result).toBe("13th");
                });
            });

            describe("when the value is 113", () => {
                beforeEach(() => {
                    value = 113;

                    act();
                });

                it("should end in th", () => {
                    expect(result).toBe("113th");
                });
            });
        });

        describe("when the tens place is two", () => {
            describe("when the value is 23", () => {
                beforeEach(() => {
                    value = 23;

                    act();
                });

                it("should end in rd", () => {
                    expect(result).toBe("23rd");
                });
            });

            describe("when the value is 123", () => {
                beforeEach(() => {
                    value = 123;

                    act();
                });

                it("should end in rd", () => {
                    expect(result).toBe("123rd");
                });
            });
        });
    });

    describe("when the value does not end in 1, 2 or 3", () => {
        describe("when the value is 7", () => {
            beforeEach(() => {
                value = 7;

                act();
            });

            it("should end in th", () => {
                expect(result).toBe("7th");
            });
        });

        describe("when the value is 17", () => {
            beforeEach(() => {
                value = 17;

                act();
            });

            it("should end in th", () => {
                expect(result).toBe("17th");
            });
        });

        describe("when the value is 27", () => {
            beforeEach(() => {
                value = 27;

                act();
            });

            it("should end in th", () => {
                expect(result).toBe("27th");
            });
        });

        describe("when the value is 107", () => {
            beforeEach(() => {
                value = 107;

                act();
            });

            it("should end in th", () => {
                expect(result).toBe("107th");
            });
        });

        describe("when the value is 117", () => {
            beforeEach(() => {
                value = 117;

                act();
            });

            it("should end in th", () => {
                expect(result).toBe("117th");
            });
        });

        describe("when the value is 127", () => {
            beforeEach(() => {
                value = 127;

                act();
            });

            it("should end in th", () => {
                expect(result).toBe("127th");
            });
        });
    });
});
