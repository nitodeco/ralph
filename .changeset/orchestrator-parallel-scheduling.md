---
"ralph": minor
---

feat: add parallel task scheduling to SessionOrchestrator

Added parallel execution capabilities to the orchestrator:

- New `ParallelExecutionConfig` interface for configuring parallel mode
- `initializeParallelExecution()` method to validate dependencies and compute parallel groups
- `startNextParallelGroup()` to begin executing a group of independent tasks
- `recordParallelTaskStart()` and `recordParallelTaskComplete()` for tracking individual task progress
- `getParallelExecutionSummary()` for monitoring parallel execution status
- Integration with SessionService parallel tracking methods
- New events: `parallel:group_start`, `parallel:group_complete`, `parallel:task_start`, `parallel:task_complete`
- Comprehensive test coverage with 14 tests

This enables ralph to execute multiple independent tasks in parallel when configured, improving throughput for PRDs with independent tasks or tasks organized with dependency metadata.
