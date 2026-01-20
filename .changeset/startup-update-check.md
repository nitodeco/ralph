---
"ralph": patch
---

Add automatic update check on startup with non-intrusive UI notification

- Added `checkForUpdateOnStartup()` function in update.ts that checks for updates respecting the 24-hour interval and skipped versions
- Added update status tracking to appStore (updateAvailable, latestVersion, updateBannerDismissed)
- Created UpdateBanner component that displays a subtle notification when an update is available
- Added `/dismiss-update` slash command to hide the update banner for the current session
- Integrated update check into useSessionLifecycle hook to run on startup
- Updated HelpView to document the new `/dismiss-update` command
