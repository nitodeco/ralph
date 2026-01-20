---
"ralph": patch
---

Refactor: Encapsulate module-level mutable state in service classes

- Create AgentProcessManager service to manage process, abort state, and retry count
- Create IterationTimer service to manage delay timeouts and project completion state
- Update agentStore to use AgentProcessManager instead of module-level refs
- Update iterationStore to use IterationTimer instead of module-level refs
