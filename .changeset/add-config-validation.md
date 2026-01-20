---
"ralph": minor
---

Add configuration validation and 'ralph config' command

- Add comprehensive config schema with validation rules
- Implement validateConfig function with clear error messages for invalid configuration
- Add CONFIG_DEFAULTS with sensible default values for all optional config fields
- Add 'ralph config' CLI command to view current configuration and validation status
- Support --json flag for machine-readable config output
- Show config file paths, effective values, and validation errors/warnings
