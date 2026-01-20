---
"ralph": minor
---

Add service container and bootstrap infrastructure for dependency injection

- Create ServiceContainer interface with ConfigService and PrdService
- Add initializeServices(), getServices(), resetServices(), and isInitialized() functions
- Add convenience accessors getConfigService() and getPrdService()
- Create bootstrapServices() for production and bootstrapTestServices() for testing
- Bootstrap services at application startup in main()
