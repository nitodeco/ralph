---
"ralph": patch
---

Standardize handler interfaces: added base Handler interface with reset() and getIsRunning() methods, updated all handlers (DecompositionHandler, LearningHandler, VerificationHandler, TechnicalDebtHandler) to implement the interface, and exported handler options types
