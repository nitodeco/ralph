---
"ralph": minor
---

Migrate SessionMemoryService to new service container architecture

- Created self-contained session-memory service directory with types.ts, validation.ts, formatters.ts, and implementation.ts
- Added SessionMemoryService to ServiceContainer with getSessionMemoryService() accessor
- Updated all consumers to use the service container pattern instead of direct imports
- Moved SessionMemory type from session.types.ts to service's types.ts
- Moved isSessionMemory type guard from type-guards.ts to service's validation.ts
- Added closure-based caching in createSessionMemoryService factory function
- Removed legacy src/lib/session-memory.ts file
