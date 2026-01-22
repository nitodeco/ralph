---
"ralph": minor
---

Add responsive terminal layout support for narrow terminals

- Added `useTerminalDimensions` hook for detecting terminal width/height and breakpoints
- Created `ResponsiveLayout` component that provides responsive context to child components
- Updated `Header` component with three variants: `full` (default), `compact`, and `minimal`
- Updated `StatusBar` with responsive variants that adapt to terminal width
- Updated `PhaseIndicator` with auto-style selection based on terminal width
- Updated `IterationProgress` with responsive progress bar width and condensed display for narrow terminals
- Breakpoints: narrow (≤60 cols), medium (61-100 cols), wide (>100 cols)
