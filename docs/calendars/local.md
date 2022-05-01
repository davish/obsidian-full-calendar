# Local notes as events

Keep each event in a calendar as a separate note in your Obsidian vault. This is currently the only option for editable events in Full Calendar. Events are stored as frontmatter on notes that is set and updated by the Full Calendar plugin when [managing events](../events/manage.md) in the calendar.

You are free to add any additional frontmatter to the notes, as well as any text content, like a description of the event, meeting notes, or anything else.

Every local note calendar has a directory where notes are stored, and if the [subfolder setting](../settings/subfolders.md) is enabled, the plugin will search for notes with event frontmatter recursively through subfolders inside that base directory. New notes will always be placed in the base directory for the calendar, though.

The note title is also managed by the plugin in the format `<YYYY-MM-DD> <Event title>`.md.

![Add calendar](../assets/add-calendar-source.gif)
