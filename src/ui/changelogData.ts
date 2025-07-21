// src/ui/changelogData.ts

export interface Change {
  type: 'new' | 'fix' | 'improvement';
  title: string;
  description: string;
}

export interface Version {
  version: string;
  changes: Change[];
}

// Add new versions to the TOP of this array.
export const changelogData: Version[] = [
  {
    version: '0.10.13-beta', // This would be our current version with the timezone fixes
    changes: [
      {
        type: 'improvement',
        title: 'Robust Timezone Support',
        description:
          'Events from local and remote calendars are now fully timezone-aware, fixing bugs related to DST and travel.'
      },
      {
        type: 'new',
        title: 'Strict Timezone Mode for Daily Notes',
        description:
          'A new setting allows users to anchor daily note events to a specific timezone, just like regular notes.'
      },
      {
        type: 'fix',
        title: 'Correctly Parse UTC Events from ICS Feeds',
        description:
          'Fixed a critical bug where events specified in UTC from Google Calendar and other sources would appear at the wrong time.'
      }
    ]
  },
  {
    version: '0.10.8',
    changes: [
      {
        type: 'new',
        title: 'ChronoAnalyser Released',
        description:
          'ChronoAnalyser can now analyse you time spending! Check the new `Analysis` button in the Full-Calender Window.'
      }
    ]
  },
  {
    version: '0.10.7',
    changes: [
      {
        type: 'new',
        title: 'Initial Plugin Release',
        description: 'Welcome to the first version of the enhanced Full Calendar!'
      }
    ]
  }
];
