---
"ralph": patch
---

Extract ParallelExecutionManager from orchestrator

- Created new parallel-execution-manager service with types, implementation, and index files
- Updated container and bootstrap to register the service
- Updated orchestrator to delegate parallel execution logic to ParallelExecutionManager
- Maintains backward compatibility with existing orchestrator API

