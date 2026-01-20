---
"ralph": minor
---

Add memory and resource management

- Add MemoryConfig interface with maxOutputBufferBytes, memoryWarningThresholdMb, and enableGarbageCollectionHints options
- Create src/lib/memory.ts with memory management functions:
  - getMemoryUsage(): Get current heap/RSS memory usage
  - checkMemoryWarning(): Log warning when memory exceeds threshold
  - suggestGarbageCollection(): Hint to garbage collector between iterations
  - cleanupTempFiles(): Remove temporary files from .ralph directory
  - truncateOutputBuffer(): Limit output buffer size to prevent unbounded growth
  - performIterationCleanup(): Orchestrate cleanup after each iteration
- Update agentStore.ts to truncate output buffer and add clearOutput action
- Integrate memory cleanup in iteration callbacks (clear output, cleanup temp files, GC hints)
- Add memory configuration options to SetupWizard (buffer size, warning threshold, GC hints)

