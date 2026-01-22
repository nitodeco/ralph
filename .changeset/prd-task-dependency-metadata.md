---
"ralph": patch
---

feat: add dependency metadata fields to PrdTask type

The PrdTask type now includes optional fields for task dependency management:

- `id`: Optional unique identifier for referencing tasks in dependencies
- `dependsOn`: Optional array of task IDs that must complete before this task
- `priority`: Optional number for scheduling priority (lower = higher priority)

The DecompositionSubtask type has also been updated to support these fields when decomposing tasks. All fields are optional to maintain backward compatibility with existing PRD files.
