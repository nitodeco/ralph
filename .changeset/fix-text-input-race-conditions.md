---
"ralph": patch
---

Fix text input race conditions for fast typing

- Refactor TextInput component to use a single ref-based source of truth for value and cursor position
- Implement input queue with microtask-based coalescing to process rapid keystrokes sequentially
- Eliminate ref/state desynchronization by processing all inputs through a unified queue
- Fix vim mode integration to coordinate state updates with TextInput through the same state mechanism
- Add pending onChange tracking to ensure value changes are emitted correctly after batch processing
