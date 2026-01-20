---
"ralph": minor
---

Implement session memory for cross-session learning

- Add SessionMemory interface to track lessons learned, successful patterns, failed approaches, and task notes
- Create session-memory.ts with functions for loading, saving, and managing memory entries
- Update buildPrompt() to inject session memory into agent prompts
- Add /learn and /note slash commands for manual memory entries
- Add /memory slash command to view and manage memory in the terminal UI
- Add 'ralph memory' CLI command with list, export, and clear subcommands
- Create MemoryView component for interactive memory management
- Integrate automatic memory recording in orchestrator:
  - Record lessons when tasks complete after retry
  - Record successful patterns when tasks complete
  - Record failed approaches when verification fails
- Memory is pruned to keep max 50 lessons, 20 patterns, and 20 failed approaches
- Memory persists across sessions in .ralph/session-memory.json
