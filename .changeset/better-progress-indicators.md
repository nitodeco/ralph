---
"ralph": minor
---

Add better progress indicators with informative spinners and progress bars

- Enhanced Spinner component with 9 context-aware variants (default, processing, waiting, success, warning, error, thinking, network, progress) using different cli-spinners animations
- Enhanced ProgressBar component with 4 style options (default, minimal, detailed, compact), auto-color mode, and configurable display options (count, bytes, suffix)
- Added PhaseIndicator component with 4 visualization styles (dots, timeline, compact, minimal) showing agent execution phase progress
- Updated IterationProgress with ETA calculation, elapsed time display, average iteration time, and enhanced visual feedback
- Updated AgentStatus with phase-specific spinner variants, visual phase timeline, and color-coded file change indicators
- Updated PlanGeneratingPhase to use thinking spinner variant

