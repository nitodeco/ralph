---
"ralph": patch
---

Unified Rules and Tasks views with shared list-detail components

- Added SelectableList component for generic list navigation with selection indicator
- Added DetailPanel component for bordered detail display panels
- Added useListNavigation hook for shared keyboard navigation logic
- Refactored TasksView to use shared components (SelectableList, DetailPanel, useListNavigation)
- Refactored RulesView to use shared components with consistent UX patterns
- Extracted smaller subcomponents for better code organization and reusability
