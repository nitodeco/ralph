---
"ralph": patch
---

Extract HandlerCoordinator from orchestrator: created handler-coordinator service with types, implementation, and index files; updated container and bootstrap to register the service; updated orchestrator to delegate handler management (DecompositionHandler, VerificationHandler, event subscriptions for agent:complete and agent:error) to HandlerCoordinator
