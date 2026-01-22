---
"ralph": minor
---

Add idempotent operations to prevent duplicate work

- Create idempotency module with content hashing, atomic file writes, operation tracking, debounced writers, and batched updaters
- Update SessionService, PrdService, iteration-logs, ConfigService, GuardrailsService, SessionMemoryService, FailurePatterns, and ProjectRegistry to use idempotent file writes
- Atomic file operations (write-to-temp, rename) ensure data integrity
- Content hash-based change detection skips unnecessary writes
- Operation tracker prevents duplicate work with TTL-based cleanup
- Add 43 unit tests for the idempotency module

