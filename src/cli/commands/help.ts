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
  config            View current configuration with validation
  archive           Archive completed tasks and progress file
  setup             Configure global preferences (agent, PRD format)
  update            Check for updates and install the latest version
  help              Show this help message

Options:
  -b, --background  Run Ralph in background/daemon mode (detached from terminal)
  --dry-run         Simulate agent execution without running agents (validates PRD/config)
  --json            Output in JSON format (for list and config commands)
  --verbose         Show detailed error information with context and suggestions
  -t, --task <n>    Run specific task by number or title (single task mode)
  --max-runtime <s> Set maximum runtime in seconds (stops gracefully when reached)

Slash Commands (in-app):
  /start [n|full]   Start the agent loop (default: 10 iterations, full: all tasks)
  /stop             Stop the running agent
  /resume           Resume a previously interrupted session
  /next <task>      Set next task to work on (by number or title)
  /init             Initialize a new PRD project
  /add              Add a new task to the PRD (AI-generated from description)
  /setup            Configure global preferences
  /update           Check for updates
  /archive          Archive completed tasks and progress file
  /help             Show help message
  /quit             Exit the application
`);
}

export function printVersion(version: string): void {
	console.log(`ralph v${version}`);
}
