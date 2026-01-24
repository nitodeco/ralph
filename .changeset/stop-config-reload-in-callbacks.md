---
"ralph": patch
---

Stop reloading config repeatedly in callbacks

Services now cache the RalphConfig at initialization time and use the cached version in callbacks instead of calling getConfigService().get() repeatedly. This improves performance by avoiding unnecessary config reloads during session execution.

Updated services:
- IterationCoordinator: caches config in setupIterationCallbacks
- BranchModeManager: added setRalphConfig method
- ParallelExecutionManager: added setRalphConfig method  
- SessionManager: added setConfig method
- HandlerCoordinator: uses currentConfig.config instead of reloading

