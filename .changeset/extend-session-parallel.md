---
"ralph": minor
---

Add parallel task execution tracking to session management

- Added new types for parallel execution: `TaskExecutionStatus`, `ActiveTaskExecution`, `ParallelExecutionGroup`, and `ParallelSessionState`
- Extended `Session` interface with optional `parallelState` field
- Extended `IterationLog` with `isParallelExecution` and `parallelGroup` fields for tracking parallel task executions
- Added new types `ParallelTaskExecution` and `IterationLogParallelGroup` for logging parallel task execution details
- Added 14 new methods to `SessionService` for parallel execution management:
  - `enableParallelMode` / `disableParallelMode` / `isParallelMode` for mode control
  - `startParallelGroup` / `completeParallelGroup` / `getCurrentParallelGroup` for group management
  - `startTaskExecution` / `completeTaskExecution` / `failTaskExecution` / `retryTaskExecution` for task lifecycle
  - `getActiveExecutions` / `getTaskExecution` / `isTaskExecuting` / `getActiveExecutionCount` for querying state
- Added comprehensive validation for parallel session state
- Added 39 unit tests for parallel session tracking functionality
