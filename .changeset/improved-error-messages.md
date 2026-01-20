---
"ralph": patch
---

Improve error messages and user feedback throughout the application

- Add comprehensive error codes system (E001-E999) for programmatic error handling
- Add --verbose flag to CLI for detailed error output with suggestions
- Improve config validation errors with field-specific hints and examples
- Enhance agent errors with actionable suggestions for common issues
- Add better task lookup error messages showing available tasks
- Include error codes and suggestions in JSON output for list/config commands
