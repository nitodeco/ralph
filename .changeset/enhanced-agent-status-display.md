---
"ralph": minor
---

feat: enhanced agent status display with phase detection

Replaces the generic "Agent working..." spinner with detailed phase-based status indicators:
- Shows current agent phase: starting, exploring, reading, implementing, running commands, verifying, committing
- Displays phase duration after 5 seconds (e.g., "Agent is implementing changes... (12s)")
- Shows file change statistics: created, modified, deleted counts from git status
- Polls git status every 5 seconds while agent is running

New files:
- `src/lib/agent-phase.ts` - Phase detection from agent output using regex patterns
- `src/lib/git-stats.ts` - Git status parsing for file change statistics
- `src/stores/agentStatusStore.ts` - Zustand store for phase and file change state
- `src/components/AgentStatus.tsx` - Enhanced status display component

Also fixes IterationProgress edge cases when total is 0 or current exceeds total.
