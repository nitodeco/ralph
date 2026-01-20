---
"ralph": minor
---

Add max runtime limit configuration

- Added `maxRuntimeMs` config option to set a maximum total runtime after which Ralph stops gracefully
- Added `--max-runtime <seconds>` CLI flag to set runtime limit from command line
- Display time remaining in status bar when a runtime limit is set
- Useful for time-boxed overnight runs

