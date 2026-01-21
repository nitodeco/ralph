---
"ralph": minor
---

feat: add vim-like editing to PRD text input

Added vim-like editing capabilities to the TextInput component:

- Normal mode (Esc) and Insert mode (i, a, A, I)
- Navigation: hjkl, word motions (w, b, e), line motions (0, $, ^)
- Delete operations: x, X, d+motion (dw, db, dd, d$, d0), D, C
- Undo support (u)
- Visual vim mode indicator showing [N] for normal mode and [I] for insert mode
- Block cursor highlighting in normal mode

The PlanInputPhase component now uses vim mode by default. Users can navigate
and edit their PRD specifications using familiar vim keybindings.

