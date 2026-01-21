---
"ralph": patch
---

feat: implement fixed terminal UI layout system

Adds a stable terminal UI layout that maintains consistent positioning:
- New FixedLayout component divides the terminal into header, content, and footer regions
- New ScrollableContent component wraps the content area with overflow handling
- StatusBar and CommandInput stay anchored at the bottom regardless of content changes
- Terminal resize events are handled to recalculate layout dimensions
- Refactored MainRunView to use the new layout system for improved stability
