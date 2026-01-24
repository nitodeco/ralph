---
"ralph": minor
---

Add memory monitor to stop sessions at 80% memory usage

- Created MemoryMonitorService that periodically checks system memory usage
- Sessions are automatically stopped when memory usage exceeds the configured threshold (default 80%)
- Added `memory.memoryThresholdPercent` configuration option to customize the threshold
- Memory monitor integrates with the daemon shutdown mechanism for graceful session termination
- Exit code 137 is used when session is stopped due to memory threshold
