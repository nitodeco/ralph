---
"ralph": patch
---

Reduce `RunApp` store subscription churn by grouping Zustand state/action selections into shallow-compared slices for app, agent, and iteration stores.
