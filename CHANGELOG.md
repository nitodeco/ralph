# ralph

## 0.6.0

### Minor Changes

- f96edd3: Add configuration validation and 'ralph config' command

  - Add comprehensive config schema with validation rules
  - Implement validateConfig function with clear error messages for invalid configuration
  - Add CONFIG_DEFAULTS with sensible default values for all optional config fields
  - Add 'ralph config' CLI command to view current configuration and validation status
  - Support --json flag for machine-readable config output
  - Show config file paths, effective values, and validation errors/warnings

- 745c74f: Add dry-run mode for testing PRD and configuration

  - Added --dry-run flag to CLI that simulates agent execution
  - Validates configuration and PRD files at startup
  - Displays what would be executed without making changes
  - Shows iteration-by-iteration simulation flow
  - Reports validation errors and warnings
  - Cannot be combined with background mode

- a39bc11: Add ralph list command to display PRD tasks with completion status. Supports --json flag for machine-readable output.
- 0b456c0: Add memory and resource management

  - Add MemoryConfig interface with maxOutputBufferBytes, memoryWarningThresholdMb, and enableGarbageCollectionHints options
  - Create src/lib/memory.ts with memory management functions:
    - getMemoryUsage(): Get current heap/RSS memory usage
    - checkMemoryWarning(): Log warning when memory exceeds threshold
    - suggestGarbageCollection(): Hint to garbage collector between iterations
    - cleanupTempFiles(): Remove temporary files from .ralph directory
    - truncateOutputBuffer(): Limit output buffer size to prevent unbounded growth
    - performIterationCleanup(): Orchestrate cleanup after each iteration
  - Update agentStore.ts to truncate output buffer and add clearOutput action
  - Integrate memory cleanup in iteration callbacks (clear output, cleanup temp files, GC hints)
  - Add memory configuration options to SetupWizard (buffer size, warning threshold, GC hints)

- 5cc43c3: Add 'ralph stop' command for gracefully shutting down running Ralph processes

  - Sends SIGTERM for graceful shutdown with configurable timeout
  - Falls back to SIGKILL if process doesn't exit within timeout
  - Updates session status to 'stopped' for potential resume
  - Handles edge cases like stale PID files and already-stopped processes

- 6608198: Add task dependency and ordering support

  - Added optional 'dependsOn' field to PrdTask type for specifying task dependencies
  - Implemented dependency resolution in getNextTask - tasks only execute when dependencies are complete
  - Added circular dependency validation when loading PRD files
  - Updated PRD generation prompts to support dependency specification
  - Enhanced task list display with dependency visualization and blocked status indicators

- 286e931: Add task priority and manual task selection

  - Added optional 'priority' field (high/medium/low) to PrdTask type
  - Tasks are now sorted by priority when selecting the next task to work on
  - Added /next command to manually select which task to work on next
  - Updated TaskList component to show priority indicators with colored icons
  - Added --task (-t) CLI flag for single task execution mode
  - Updated ralph list command to display priority information

- f478991: Add 'ralph status' command to display session state, progress, and recent logs
- 64fce92: Implement progress file improvements with structured data including timestamps, iteration numbers, error/retry logging, session summary headers, and file rotation to prevent unbounded growth.
- 329faf8: Refactor internals
- f9d96aa: Implement signal handling for graceful shutdown

  - Added signal handlers for SIGTERM, SIGINT, and SIGHUP
  - Save session state as 'stopped' on signal receipt for resumability
  - Gracefully terminate running agent process via shutdown handler
  - Clean up PID file on exit
  - Log shutdown signal and completion to log file
  - Integrated shutdown handler with agent store for proper agent termination

### Patch Changes

- 12c58e9: Fix argument parsing bug that prevented CLI commands from working

  - Fixed critical bug in parseArgs function where the first CLI argument was always filtered out
  - The filter condition `argIndex !== taskIndex + 1` incorrectly evaluated to `argIndex !== 0` when no --task flag was present (taskIndex = -1)
  - Changed to `(taskIndex === -1 || argIndex !== taskIndex + 1)` to only filter the task value when --task flag is used
  - This fix enables all CLI commands (status, list, config, help, etc.) to work correctly

- 14641b6: Remove priority from prd
- c59b0cf: Add Linux support to the update system. Linux binaries (arm64 and x64) are now included in releases and the self-update system can download and install them on Linux platforms.

## 0.5.0

### Minor Changes

- 32d79da: Refactor state management to use zustand

### Patch Changes

- 3ba8440: Restart after update

## 0.4.0

### Minor Changes

- 5daa339: Add agent timeout and watchdog functionality

  - Add configurable agent timeout (default 30 minutes) to kill long-running agent processes
  - Add stuck detection based on stdout/stderr activity with configurable threshold (default 5 minutes)
  - Agent is killed and retried if timeout or stuck threshold is exceeded
  - Both features can be disabled by setting threshold to 0
  - Add SetupWizard steps for configuring timeout and stuck detection settings

- 30291b0: Add background/daemon mode for unattended overnight runs

  - Add --background or -b flag to run Ralph detached from the terminal
  - Write PID to .ralph/ralph.pid for process tracking
  - Redirect stdout/stderr to log file in background mode
  - Automatically start iterations when running as a daemon
  - Clean up PID file on process exit or termination signals

- 3a5c0af: Add notification system for completion and failures

  - Add NotificationConfig type with options for system notifications, webhook URL, and marker file
  - Implement macOS system notifications using osascript
  - Add HTTP POST webhook notifications support
  - Add completion marker file option for script integration
  - Send notifications on: all tasks complete, max iterations reached, fatal error
  - Add notification configuration steps to SetupWizard

- 120c426: Add notification system

### Patch Changes

- 8b61197: Fix session.json not updating correctly and other agent loop issues

## 0.3.2

### Patch Changes

- be1d52c: Fix commands not being possible during agent loop and custom instructions not loading correctly
- f7fa7ea: Add logging
- b23adb1: Fix iteration count not being displayed correctly

## 0.3.1

### Patch Changes

- afb9aed: Add progress bar to update download

## 0.3.0

### Minor Changes

- 874e62b: Add `full` argument to start command to implement entire prd
- 7851104: Add resume command

### Patch Changes

- 7851104: Fix agent loop breaking after first iteration
- 394d747: Move streaming agent output preview to background and dim

## 0.2.2

### Patch Changes

- 3ab66db: Fix agent response streaming leading to timeouts

## 0.2.1

### Patch Changes

- Fix version not being correctly displayed

## 0.2.0

### Minor Changes

- Add custom instructions

## 0.1.0

### Minor Changes

- Initial release
