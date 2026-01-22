---
"ralph": patch
---

feat: add cross-session usage statistics tracking

Adds a new UsageStatisticsService that tracks usage metrics across sessions:

- Tracks lifetime statistics: total sessions, iterations, tasks completed, success rates
- Records recent sessions with details like duration, status, and performance
- Maintains daily usage data for trend analysis
- Provides streak tracking for consecutive days of usage

New CLI command `ralph usage` with subcommands:
- `ralph usage` or `ralph usage show` - full statistics display
- `ralph usage summary` - condensed summary
- `ralph usage sessions [limit]` - recent sessions list
- `ralph usage daily [days]` - daily usage breakdown

Statistics are automatically recorded when sessions complete, stop, or fail.
