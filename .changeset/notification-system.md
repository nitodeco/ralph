---
"ralph": minor
---

Add notification system for completion and failures

- Add NotificationConfig type with options for system notifications, webhook URL, and marker file
- Implement macOS system notifications using osascript
- Add HTTP POST webhook notifications support
- Add completion marker file option for script integration
- Send notifications on: all tasks complete, max iterations reached, fatal error
- Add notification configuration steps to SetupWizard
