---
"ralph": minor
---

Add /plan command for AI-powered PRD generation

- Add `/plan` slash command that generates a PRD from a free-form specification
- Support intelligent merging with existing PRD tasks using title similarity matching
- Show diff view with status indicators (+new, ~modified, -removed, unchanged)
- Keyboard navigation (↑/↓) through tasks with detail panel
- Accept (Enter/y) or cancel (q/Esc) generated changes
- Preserve done status for matched existing tasks
