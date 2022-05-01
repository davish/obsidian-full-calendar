# Inline event calendars

Store as many events as you like in a single note, using [Dataview inline fields](https://blacksmithgu.github.io/obsidian-dataview/data-annotation/). A common pattern is storing events within daily notes using the core Daily Notes plugin, or the [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) plugin.

## Populating the calendar

Notes can exist in any bullet point as long that has sufficient data in dataview fields. For example,

> -   Go to the store [date:: 2022-05-01] [startTime:: 17:00] [endTime:: 20:00] [allDay:: false]

Something that's important to note is that you need _two spaces_ between dataview fields for them to be rendered properly in live preview.

## Filling in the blanks

Frontmatter fields prefixed with `fc_` in a note can fill in missing inline metadata for all events in a give note. For example:

```
---
fc_date: 2022-05-01
fc_allDay: false
---

- Eat lunch [startTime:: 17:00]  [endTime:: 20:00]
- Go to the gym [startTime:: 19:00]  [endTime:: 20:00]
```

Both the event "Eat lunch" and "Go to the gym" will appear at their respective times on 2022-05-01.

## Creating and editing notes
