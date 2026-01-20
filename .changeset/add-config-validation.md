---
"ralph": minor
---

Add configuration validation and 'ralph config' command

- Implement comprehensive config schema with validation rules for all fields
- Add validateConfig function that validates agent, prdFormat, retry settings, timeout settings, memory config, and notifications
- Add warnings for potentially problematic configurations (e.g., stuck threshold >= agent timeout)
- Add formatValidationErrors to display clear, actionable error messages
- Add 'ralph config' command to view current configuration with validation status
- Support --json flag for machine-readable config output
- Show both global and project config file paths
- Display which settings are overridden by project config
- Export DEFAULT_ENABLE_GC_HINTS from config.ts for consistency
