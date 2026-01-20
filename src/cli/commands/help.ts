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
  setup             Configure global preferences (agent, PRD format)
  update            Check for updates and install the latest version
  help              Show this help message

Options:
  -b, --background  Run Ralph in background/daemon mode (detached from terminal)
  --dry-run         Simulate agent execution without running agents (validates PRD/config)
  --json            Output in JSON format (for list and config commands)
  -t, --task <n>    Run specific task by number or title (single task mode)

Slash Commands (in-app):
  /start [n|full]   Start the agent loop (default: 10 iterations, full: all tasks)
  /stop             Stop the running agent
  /resume           Resume a previously interrupted session
  /next <task>      Set next task to work on (by number or title)
  /init             Initialize a new PRD project
  /add              Add a new task to the PRD (AI-generated from description)
  /setup            Configure global preferences
  /update           Check for updates
  /help             Show help message
  /quit             Exit the application

Examples:
  ralph             Open the Ralph UI
  ralph init        Create a new PRD project from a description
  ralph resume      Resume a previously interrupted session
  ralph status      Check on a running or interrupted session
  ralph stop        Stop a background Ralph process gracefully
  ralph list        View all tasks and their completion status
  ralph list --json Output task list as JSON for scripting
  ralph config      View current configuration and validation status
  ralph config --json  Output configuration as JSON for scripting
  ralph update      Check for and install updates
  ralph -b          Start Ralph in background mode (logs to .ralph/ralph.log)
  ralph resume -b   Resume session in background mode
  ralph --dry-run   Test configuration and PRD without running agents
`);
}

export function printVersion(version: string): void {
	console.log(`ralph v${version}`);
}
