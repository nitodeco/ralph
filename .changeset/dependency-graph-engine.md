---
"ralph": patch
---

feat: add task dependency graph engine

Implements a comprehensive dependency graph engine for analyzing and managing task dependencies in PRDs. The engine provides:

- `buildDependencyGraph`: Constructs a directed graph from task dependencies
- `validateDependencies`: Validates dependencies for missing refs, cycles, and self-references
- `detectCycles`: Detects circular dependencies using DFS
- `getTopologicalOrder`: Returns tasks sorted in dependency order
- `getReadyTasks`: Returns tasks that have all dependencies satisfied
- `getBlockedTasks`: Returns tasks waiting on incomplete dependencies
- `getNextReadyTask`: Returns the highest priority ready task
- `canExecuteTask`: Checks if a specific task can be executed
- `getExecutionOrder`: Returns the order tasks should be executed
- `getParallelExecutionGroups`: Groups tasks that can run in parallel

This engine enables parallel task execution by identifying which tasks can run concurrently based on their dependency relationships.
