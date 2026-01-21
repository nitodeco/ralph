---
"ralph": patch
---

fix: setup wizard no longer repeats on every start

The globalConfigExists() function now directly checks the file system instead of going through the service container. This ensures the setup wizard correctly detects an existing config file regardless of service initialization state.
