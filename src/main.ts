/**
 * @file main.ts
 * @brief Main plugin entry point for Obsidian Full Calendar.
 *
 * @description
 * This file contains the `FullCalendarPlugin` class, which is the primary
 * controller for the entire plugin. It manages the plugin's lifecycle,
 * including loading/unloading, settings management, command registration,
 * and view initialization. It serves as the central hub that wires together
 * the event cache, UI components, and Obsidian's application workspace.
 *
 * @license See LICENSE.md
 */

import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { CalendarView, FULL_CALENDAR_SIDEBAR_VIEW_TYPE, FULL_CALENDAR_VIEW_TYPE } from './ui/view';
import { renderCalendar } from './ui/calendar';
import { toEventInput } from './ui/interop';
import { DEFAULT_SETTINGS, FullCalendarSettings, FullCalendarSettingTab } from './ui/settings';
import { PLUGIN_SLUG } from './types';
import EventCache from './core/EventCache';
import { ObsidianIO } from './ObsidianAdapter';
import { launchCreateModal } from './ui/event_modal';
import FullNoteCalendar from './calendars/FullNoteCalendar';
import DailyNoteCalendar from './calendars/DailyNoteCalendar';
import ICSCalendar from './calendars/ICSCalendar';
import CalDAVCalendar from './calendars/CalDAVCalendar';
import { manageTimezone } from './core/Timezone';
import { AnalysisView, ANALYSIS_VIEW_TYPE } from './chrono_analyser/AnalysisView';

export default class FullCalendarPlugin extends Plugin {
  settings: FullCalendarSettings = DEFAULT_SETTINGS;

  // To parse `data.json` file.`
  cache: EventCache = new EventCache(this, {
    local: (info, settings) =>
      info.type === 'local'
        ? new FullNoteCalendar(new ObsidianIO(this.app), info.color, info.directory, settings)
        : null,
    dailynote: (info, settings) =>
      info.type === 'dailynote'
        ? new DailyNoteCalendar(new ObsidianIO(this.app), info.color, info.heading, settings)
        : null,
    ical: (info, settings) =>
      info.type === 'ical' ? new ICSCalendar(info.color, info.url, settings) : null,
    caldav: (info, settings) =>
      info.type === 'caldav'
        ? new CalDAVCalendar(
            info.color,
            info.name,
            {
              type: 'basic',
              username: info.username,
              password: info.password
            },
            info.url,
            info.homeUrl,
            settings
          )
        : null,
    FOR_TEST_ONLY: () => null
  });

  renderCalendar = renderCalendar;
  processFrontmatter = toEventInput;

  /**
   * Activates the Full Calendar view.
   * If a calendar view is already open in a main tab, it focuses that view.
   * Otherwise, it opens a new calendar view in a new tab.
   * This prevents opening multiple duplicate calendar tabs.
   */
  async activateView() {
    const leaves = this.app.workspace
      .getLeavesOfType(FULL_CALENDAR_VIEW_TYPE)
      .filter(l => (l.view as CalendarView).inSidebar === false);
    if (leaves.length === 0) {
      // if not open in main view, open a new one
      const leaf = this.app.workspace.getLeaf('tab');
      await leaf.setViewState({
        type: FULL_CALENDAR_VIEW_TYPE,
        active: true
      });
    } else {
      // if already open, just focus it
      await Promise.all(leaves.map(l => (l.view as CalendarView).onOpen()));
    }
  }

  /**
   * Plugin load lifecycle method.
   * This method is called when the plugin is enabled.
   * It initializes settings, sets up the EventCache, registers the calendar
   * and sidebar views, adds the ribbon icon and commands, and sets up
   * listeners for Vault file changes (create, rename, delete).
   */
  async onload() {
    await this.loadSettings();
    await manageTimezone(this);

    this.cache.reset(this.settings.calendarSources);

    // Respond to obsidian events
    this.registerEvent(
      this.app.metadataCache.on('changed', file => {
        this.cache.fileUpdated(file);
      })
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile) {
          console.debug('FILE RENAMED', file.path);
          this.cache.deleteEventsAtPath(oldPath);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on('delete', file => {
        if (file instanceof TFile) {
          console.debug('FILE DELETED', file.path);
          this.cache.deleteEventsAtPath(file.path);
        }
      })
    );

    // @ts-ignore
    window.cache = this.cache;

    this.registerView(FULL_CALENDAR_VIEW_TYPE, leaf => new CalendarView(leaf, this, false));

    this.registerView(FULL_CALENDAR_SIDEBAR_VIEW_TYPE, leaf => new CalendarView(leaf, this, true));

    this.registerView(ANALYSIS_VIEW_TYPE, leaf => new AnalysisView(leaf, this));

    // Register the calendar icon on left-side bar
    this.addRibbonIcon('calendar-glyph', 'Open Full Calendar', async (_: MouseEvent) => {
      await this.activateView();
    });

    this.addSettingTab(new FullCalendarSettingTab(this.app, this));

    // Commands visible in the command palette
    this.addCommand({
      id: 'full-calendar-new-event',
      name: 'New Event',
      callback: () => {
        launchCreateModal(this, {});
      }
    });
    this.addCommand({
      id: 'full-calendar-reset',
      name: 'Reset Event Cache',
      callback: () => {
        this.cache.reset(this.settings.calendarSources);
        this.app.workspace.detachLeavesOfType(FULL_CALENDAR_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(FULL_CALENDAR_SIDEBAR_VIEW_TYPE);
        new Notice('Full Calendar has been reset.');
      }
    });
    this.addCommand({
      id: 'full-calendar-revalidate',
      name: 'Revalidate remote calendars',
      callback: () => {
        this.cache.revalidateRemoteCalendars(true);
      }
    });
    this.addCommand({
      id: 'full-calendar-open',
      name: 'Open Calendar',
      callback: () => {
        this.activateView();
      }
    });
    this.addCommand({
      id: 'full-calendar-open-sidebar',
      name: 'Open in sidebar',
      callback: () => {
        if (this.app.workspace.getLeavesOfType(FULL_CALENDAR_SIDEBAR_VIEW_TYPE).length) {
          return;
        }
        const targetLeaf = this.app.workspace.getRightLeaf(false);
        if (targetLeaf) {
          targetLeaf.setViewState({
            type: FULL_CALENDAR_SIDEBAR_VIEW_TYPE
          });
          this.app.workspace.revealLeaf(targetLeaf);
        } else {
          console.warn('Right leaf not found for calendar view!');
        }
      }
    });

    // Register view content on hover
    (this.app.workspace as any).registerHoverLinkSource(PLUGIN_SLUG, {
      display: 'Full Calendar',
      defaultMod: true
    });
  }

  /**
   * Plugin unload lifecycle method.
   * This method is called when the plugin is disabled.
   * It cleans up by detaching all calendar and sidebar views.
   */
  onunload() {
    this.app.workspace.detachLeavesOfType(FULL_CALENDAR_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(FULL_CALENDAR_SIDEBAR_VIEW_TYPE);
  }

  /**
   * Loads plugin settings from disk, merging them with default values.
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Saves the current plugin settings to disk.
   * After saving, it triggers a reset and repopulation of the event cache
   * to ensure all calendars are using the new settings.
   */
  async saveSettings() {
    new Notice('Resetting the event cache with new settings...');
    await this.saveData(this.settings);
    this.cache.reset(this.settings.calendarSources);
    await this.cache.populate();
    this.cache.resync();
  }
}
