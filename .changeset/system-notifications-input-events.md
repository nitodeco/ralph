---
"ralph": minor
---

Add system notifications for user input events

- Add new notification event types: input_required, session_paused, verification_failed
- Send session_paused notification when user stops the session
- Send verification_failed notification when verification checks fail
- All notifications respect the systemNotification config setting
