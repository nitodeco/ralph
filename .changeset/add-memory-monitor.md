---
"ralph": minor
---

Add memory monitor to stop sessions when process memory exceeds threshold

- Created MemoryMonitorService that periodically checks process memory (RSS)
- Sessions are automatically stopped when process memory exceeds the configured threshold (default 1024 MB)
- Added `memory.memoryThresholdMb` configuration option to customize the threshold
- Memory monitor integrates with the daemon shutdown mechanism for graceful session termination
- Exit code 137 is used when session is stopped due to memory threshold
- Changed from system-wide memory percentage to process RSS in MB for reliable cross-runtime behavior
