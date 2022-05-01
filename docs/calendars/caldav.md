# Remote calendar from private iCloud or any CalDAV source

Add any calendar that supports CalDAV over HTTPS basic authentication. This has currently been verified to work for [iCloud Calendars](https://www.icloud.com/calendar). You'll first need to create an [app-specific password](https://support.apple.com/en-us/HT204397) for this plugin. Armed with that info, you can now add your private Apple Calendars.

![](../assets/sync-setup-caldav.gif)

### Non-working providers

There are a few providers which are not yet supported by the CalDAV sync option:

-   Google Calendar requires OAuth instead of HTTP basic authentication.
-   Fastmail uses app-specific passwords, but is not properly parsed by Full Calendar's integration. You can follow [this issue](https://github.com/davish/obsidian-full-calendar/issues/87) with updates.
