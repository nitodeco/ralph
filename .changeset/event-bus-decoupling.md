---
"ralph": patch
---

Introduce event bus to decouple stores

- Create typed EventEmitter class in src/lib/events.ts with events for agent, iteration, and session lifecycle
- Update agentStore to emit events instead of directly calling other stores
- Update iterationStore to emit iteration lifecycle events
- Update orchestrator to subscribe to event bus and coordinate between stores
- Update appStore to emit session lifecycle events
- Remove direct cross-store getState() calls from agentStore (orchestrator now coordinates)
