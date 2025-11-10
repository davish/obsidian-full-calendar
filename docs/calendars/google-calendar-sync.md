# Google Calendar Sync Setup Guide

This guide will help you set up Google Calendar synchronization with Obsidian Full Calendar.

## Overview

The Google Calendar sync feature allows you to:
- **Automatically sync events** from Obsidian to your Google Calendar
- **One-way sync**: Changes made in Obsidian are pushed to Google Calendar (Obsidian → Google)
- **Automatic periodic sync**: Events are synced every N minutes in the background
- **Local-first storage**: Events remain stored as markdown files in your Obsidian vault

## Prerequisites

1. A Google account
2. Access to the Google Cloud Console
3. Obsidian with the Full Calendar plugin installed

## Step 1: Create Google OAuth Credentials

### 1.1 Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" at the top
3. Click "New Project"
4. Enter a project name (e.g., "Obsidian Full Calendar")
5. Click "Create"

### 1.2 Enable Google Calendar API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and then click "Enable"

### 1.3 Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (unless you have a Google Workspace account)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: "Obsidian Full Calendar"
   - **User support email**: Your email
   - **Developer contact information**: Your email
   - **App logo**: (Optional - can skip)
   - **Application home page**: (Optional - can use `https://github.com/digRabbit/obsidian-full-calendar-gcal-sync`)
   - **Application privacy policy link**: (Optional - can skip for testing)
   - **Application terms of service link**: (Optional - can skip for testing)
   - **Authorized domains**: (Leave empty for testing - this is for domain names like `example.com`, NOT for redirect URIs)
5. Click "Save and Continue"
6. On the "Scopes" page, click "Add or Remove Scopes"
7. In the filter box, search for: `calendar`
8. Check the box for: `https://www.googleapis.com/auth/calendar` (Calendar API)
9. Click "Update" then "Save and Continue"
10. On "Test users", click "+ ADD USERS"
11. Add your Google email address (the one you'll use to authenticate)
12. Click "Add" then "Save and Continue"
13. Review the summary and click "Back to Dashboard"

**Important Notes:**
- While in "Testing" mode, only test users can authenticate
- The app will show a warning screen - this is normal for testing mode
- To publish the app (remove the warning), you'll need to complete Google's verification process (not required for personal use)

### 1.4 Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Desktop app" as the application type
4. Name it "Obsidian Full Calendar"
5. Click "Create"
6. **Important**: Save the "Client ID" and "Client Secret" - you'll need these!

### 1.5 Redirect URI Configuration

**Good News**: For "Desktop app" OAuth clients, Google automatically handles the redirect URI - you don't need to register it manually!

The plugin uses `http://localhost` as the redirect URI, which is the standard for desktop applications. Google's OAuth system will automatically accept this for desktop app clients.

**Note**: When Google redirects to `http://localhost` after authentication, you'll see a "This site can't be reached" error in your browser - this is normal and expected! The authorization code will be in the URL. Just copy the `code` parameter from the URL and paste it into Obsidian.

## Step 2: Configure Obsidian Full Calendar

### 2.1 Add Google OAuth Settings

1. Open Obsidian Settings
2. Go to "Full Calendar" plugin settings
3. Find the "Google Calendar OAuth" section
4. Enter your **Client ID** and **Client Secret** from Step 1.4
5. The **Redirect URI** should be pre-filled as: `http://localhost` (make sure this is registered in Google Cloud Console - see Step 1.5)

### 2.2 Add Google Calendar as a Calendar Source

1. In Full Calendar settings, click "Add Calendar"
2. Select "Google Calendar" from the dropdown
3. Configure the calendar:
   - **Directory**: The folder where events will be stored (e.g., "CalendarData")
   - **Calendar ID**: Use "primary" for your main calendar, or the specific calendar ID
   - **Color**: Choose a color for events from this calendar
   - **Enable Sync**: Toggle this on
   - **Sync Interval**: How often to sync (in minutes, default is 5)

### 2.3 Authenticate with Google

1. After adding the Google Calendar, click "Authenticate with Google"
2. A browser window will open asking you to sign in to Google
3. Sign in with your Google account
4. Grant the requested permissions (Calendar access)
5. You'll see a success message in Obsidian

## Step 3: Using Google Calendar Sync

### Automatic Sync

Once configured, your events will automatically sync from Obsidian to Google Calendar:

- **New events** created in Obsidian will be created in Google Calendar
- **Modified events** in Obsidian will be updated in Google Calendar
- **Deleted events** in Obsidian will be deleted from Google Calendar
- Sync happens automatically every N minutes (based on your sync interval setting)

### Manual Sync

You can also trigger a manual sync:
1. Open Full Calendar view
2. Run the command "Full Calendar: Sync Google Calendar" (if available)

### Viewing Sync Status

Check the console (Ctrl+Shift+I / Cmd+Option+I) for sync logs:
- Successful syncs will show: "Google Calendar sync: Successfully synced N calendar(s)"
- Failed syncs will show error messages

## Troubleshooting

### "Error 400: invalid_request" or "Access blocked: Authorization Error"

This error means Google is blocking the OAuth request. Common causes:

1. **"Missing required parameter: redirect_uri" error:**
   - Make sure you selected "Desktop app" as the application type when creating the OAuth client
   - The plugin uses `http://localhost` as the redirect URI (this is automatic for desktop apps)
   - Verify the Redirect URI in Obsidian settings is set to: `http://localhost`
   - If the error persists, try rebuilding the plugin and copying the new `main.js` to your vault
   
   **Note**: For desktop apps, Google doesn't require you to manually register redirect URIs - it's handled automatically. If you see a redirect URI field, it's likely for a different client type (like "Web application").

2. **Not added as a test user:**
   - Go to OAuth consent screen → Test users
   - Make sure your Google email is added
   - If you're not a test user, you'll see the "Access blocked" error

3. **OAuth consent screen not properly configured:**
   - Make sure you completed all steps in section 1.3
   - Verify the scope `https://www.googleapis.com/auth/calendar` is added
   - Check that you clicked "Save and Continue" on all pages

4. **Using wrong redirect URI:**
   - In Obsidian settings, the Redirect URI should be: `obsidian://google-calendar-callback`
   - This must match exactly what's in Google Cloud Console
   - Alternative: Try using `urn:ietf:wg:oauth:2.0:oob` (update both places)

5. **App needs to be published (for non-test users):**
   - If you want others to use it, you need to publish the app
   - For personal use, just make sure you're added as a test user

### "Not authenticated with Google Calendar"

- Re-authenticate by going to Full Calendar settings
- Click "Authenticate with Google" again
- Make sure you grant all requested permissions
- Verify you're added as a test user in OAuth consent screen

### "Authentication expired"

- The access token has expired
- The plugin should automatically refresh it
- If issues persist, re-authenticate

### Events not syncing

1. Check that "Enable Sync" is toggled on
2. Verify your OAuth credentials are correct
3. Check the console for error messages
4. Ensure your calendar directory exists and contains valid event files

### "Calendar API not enabled"

- Go to Google Cloud Console
- Enable the Google Calendar API (see Step 1.2)

## Limitations

- **One-way sync only**: Changes in Google Calendar are NOT synced back to Obsidian
- **Single events only**: Currently only syncs single events, not recurring events
- **No conflict resolution**: The latest change in Obsidian overwrites Google Calendar

## Security Notes

- Your OAuth credentials are stored in Obsidian's plugin data
- The Client Secret is sensitive - don't share it
- You can revoke access anytime from your [Google Account](https://myaccount.google.com/permissions)

## Privacy

This plugin:
- Only accesses your Google Calendar data
- Does not send data to any third-party servers
- Communicates directly with Google's servers
- Stores credentials locally in Obsidian

## Support

For issues or questions:
- Check the [GitHub repository](https://github.com/digRabbit/obsidian-full-calendar-gcal-sync)
- Report bugs in the Issues section

---

**Note**: This is a fork of the original obsidian-full-calendar plugin with Google Calendar sync functionality added.
