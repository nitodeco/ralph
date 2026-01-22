---
"ralph": patch
---

Fix slash command hint navigation with arrow keys. When typing a partial slash command, the suggestion list now properly follows the selected item using viewport windowing. Previously, navigating past the 5th suggestion would leave the selection indicator invisible because the selected item was outside the displayed window. Now, the window scrolls to keep the selected item visible, showing indicators for items above and below the viewport.
