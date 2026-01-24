---
"ralph": patch
---

Enforce direct-calls event architecture by removing unused events

- Chose Option B (direct calls) over Option A (event-driven) for cleaner architecture
- Removed 16 unused event types that had no consumers (agent:start, agent:retry, iteration:*, session:*, parallel:*)
- Kept only agent:complete and agent:error events which have actual consumers in handler-coordinator
- Removed event emissions from: agent.ts, iterationStore.ts, appStore.ts, session-manager, iteration-coordinator, parallel-execution-manager, branch-mode-manager
- The callback pattern (IterationCallbacks, handler callbacks) already provides clear data flow
- Each retained event now has a single purpose with at least one consumer
