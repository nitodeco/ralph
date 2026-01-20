---
"ralph": patch
---

Migrate SessionService to new service architecture

- Created src/lib/services/session/ directory with self-contained service files
- Created types.ts with Session, SessionStatus, SessionStatistics, IterationTiming interfaces and SessionService interface
- Created validation.ts with isSession, isSessionStatus type guards
- Created implementation.ts with createSessionService factory function using closure-based caching
- Updated container.ts to add SessionService to ServiceContainer and getSessionService() accessor
- Updated bootstrap.ts to create SessionService instance and add mock for tests
- Updated index.ts to re-export Session, SessionService, SessionStatus types
- Updated all consumers (orchestrator.ts, appStore.ts, daemon.ts, CLI commands, useSlashCommands.ts)
- Updated test files to use the new service
- Removed Session types from src/types/session.types.ts
- Removed isSession from src/lib/type-guards.ts
- Deleted src/lib/session.ts
