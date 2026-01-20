---
"ralph": minor
---

Add task dependency and ordering support

- Added optional 'dependsOn' field to PrdTask type for specifying task dependencies
- Implemented dependency resolution in getNextTask - tasks only execute when dependencies are complete
- Added circular dependency validation when loading PRD files
- Updated PRD generation prompts to support dependency specification
- Enhanced task list display with dependency visualization and blocked status indicators
