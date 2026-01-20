---
"ralph": patch
---

Fix UI offset caused by agent output stream on iteration completion

- AgentOutput component now returns null when there's no content to display, preventing empty boxes from causing layout shifts
- Agent state is now properly reset on iteration completion instead of only on iteration start, ensuring clean state between iterations
