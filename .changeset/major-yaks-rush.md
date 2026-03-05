---
"ralph": patch
---

Fix shutdown and signal handling races by making shutdown entry atomic, preventing duplicate signal handler registration, and hardening cleanup paths so session persistence, UI unmount, and service bootstrap failures do not leave the process in a partial state.
