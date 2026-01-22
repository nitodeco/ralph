---
"ralph": patch
---

Fix task list scrolling in PlanReviewPhase for condensed terminal views. Implements viewport windowing to ensure the selected task is always visible when navigating with arrow keys. Shows 5 tasks in narrow terminals vs 8 in normal view, with scroll indicators showing items above/below the viewport.
