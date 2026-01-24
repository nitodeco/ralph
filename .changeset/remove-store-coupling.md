---
"ralph": patch
---

Remove store-to-store coupling by introducing dependency injection

- Added setAgentStoreDependencies() to inject agentStatusStore dependencies into agentStore
- Added setAppStoreDependencies() to inject agentStore and iterationStore dependencies into appStore
- Updated index.tsx to wire up all store dependencies at bootstrap time
- Stores no longer directly import or call getState() on other stores
- This improves testability and makes data flow more explicit
