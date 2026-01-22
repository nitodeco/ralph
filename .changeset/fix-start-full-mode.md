---
"ralph": patch
---

Fixed /start full command to continue running until all tasks are complete. Previously, when running in full mode, the session would stop when the initial iteration count (based on incomplete tasks) was reached, even if tasks hadn't been completed due to retries, verification failures, or decomposition. Now the iteration limit automatically extends when there are still pending tasks.
