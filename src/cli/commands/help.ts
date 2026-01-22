export function printHelp(version: string): void {
	console.log(`
◆ ralph v${version}

A CLI tool for long-running PRD-driven development with AI coding agents

Usage:
  ralph                   Open the Ralph UI (use /start to begin)
  ralph <command> [options]

Commands:
  init              Initialize a new PRD project (AI-generated from description)
  resume            Resume a previously interrupted session
  status            Show current session state, progress, and recent logs
  stop              Stop a running Ralph process gracefully
  list              Display all PRD tasks and their completion status
  task              Manage task completion (for agent use)
  progress          View and manage progress notes (for agent use)
  config            View current configuration with validation
  archive           Archive completed tasks and progress file
  clear             Clear session data (archives first, then resets session)
  guardrails        View and manage prompt guardrails
  analyze           Analyze failure patterns and get suggestions
  memory            View and manage session memory (lessons, patterns, notes)
  projects          View and manage all registered Ralph projects
  migrate           Migrate local .ralph directory to global storage
  setup             Configure global preferences (agent, PRD format)
  update            Check for updates and install the latest version
  help              Show this help message

Analyze Subcommands:
  analyze           Show failure pattern analysis (default)
  analyze export    Export analysis as JSON
  analyze clear     Clear failure history

Memory Subcommands:
  memory            Show session memory (default)
  memory export     Export memory as markdown
  memory clear      Clear session memory

Projects Subcommands:
  projects          List all registered projects (default)
  projects current  Show details about the current project
  projects prune    Remove projects with invalid paths

Task Subcommands:
  task              List all tasks with status (default)
  task done <id>    Mark a task as done (by number or title)
  task undone <id>  Mark a task as not done
  task current      Show the next pending task

Progress Subcommands:
  progress          Show progress notes (default)
  progress add <text>  Add a progress note
  progress clear    Clear all progress notes

Guardrails Subcommands:
  guardrails               List all guardrails (default)
  guardrails add <text>    Add a new guardrail
  guardrails remove <id>   Remove a guardrail by ID
  guardrails toggle <id>   Enable/disable a guardrail
  guardrails generate      Auto-generate guardrails from codebase analysis
  guardrails generate --apply  Generate and immediately add guardrails

Options:
  -b, --background       Run Ralph in background/daemon mode (detached from terminal)
  --dry-run              Simulate agent execution without running agents (validates PRD/config)
  --json                 Output in JSON format (for list, config, analyze, and memory commands)
  --verbose              Show detailed error information with context and suggestions
  -t, --task <n>         Run specific task by number or title (single task mode)
  --max-runtime <s>      Set maximum runtime in seconds (stops gracefully when reached)
  --skip-verification    Skip verification checks after each iteration

Slash Commands (in-app):
  /start [n|full]   Start the agent loop (default: 10 iterations, full: all tasks)
  /stop             Stop the running agent
  /resume           Resume a previously interrupted session
  /next <task>      Set next task to work on (by number or title)
  /task done <id>   Mark a task as done (by number or title)
  /task undone <id> Mark a task as pending (by number or title)
  /task current     Show the next pending task
  /task list        Open the tasks view
  /tasks            Open the tasks view
  /init             Initialize a new PRD project
  /add              Add a new task to the PRD (AI-generated from description)
  /guardrail <text> Add a new guardrail instruction
  /guardrails       View and manage guardrails
  /analyze          View failure pattern analysis
  /learn <lesson>   Add a lesson to session memory
  /note <note>      Add a note about the current task
  /memory           View and manage session memory
  /projects         View and manage all registered projects
  /migrate          Migrate local .ralph to global storage
  /setup            Configure global preferences
  /update           Check for updates
  /archive          Archive completed tasks and progress file
  /clear            Clear session data (archives first, then resets session)
  /help             Show help message
  /quit             Exit the application
`);
}

export function printVersion(version: string): void {
	console.log(`ralph v${version}`);
}
