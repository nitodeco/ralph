# ralph

## 0.10.0

### Minor Changes

- 53effd6: Add adaptive retry with failure context injection

  - Create failure-analyzer.ts with pattern detection for build failures, test failures, lint errors, permission errors, timeouts, stuck processes, network errors, syntax errors, and dependency errors
  - Implement generateRetryContext() to format contextual guidance for retry attempts
  - Update agentStore to analyze failures and inject context into subsequent retry prompts
  - Add IterationLogRetryContext type to track retry history in iteration logs
  - Add retryWithContext config option (default: true) to enable/disable adaptive retry
  - Log retry analysis to progress.txt for debugging

- 970fcec: Add /clear command to clear existing session and archive done tasks
- ff66ea6: Remove yaml as PRD format
- a73f17e: Add failure pattern learning and analysis system

  - Track failure patterns across iterations and sessions to identify recurring issues
  - Store failure history in .ralph/failure-history.json with rolling window (last 100 failures)
  - Implement pattern detection using regex matching and string similarity for common failure types
  - Add 'ralph analyze' CLI command that displays: top failure patterns, suggested guardrails, tasks with highest failure rates, and recommendations
  - Add 'ralph analyze export' to export analysis as JSON for external processing
  - Add 'ralph analyze clear' to clear failure history
  - Add '/analyze' slash command in the terminal UI to view failure pattern analysis
  - Add AnalyzeView component for interactive pattern viewing and guardrail suggestions
  - Automatically record failures and analyze patterns after each failed iteration when learningEnabled is true
  - When a pattern reaches threshold (3 occurrences), automatically suggest adding a guardrail
  - Add learningEnabled config option (boolean, default true) to enable/disable pattern learning

- 88b71e5: Add dynamic prompt guardrail system for tuning agent behavior

  - Added PromptGuardrail interface with id, instruction, trigger, category, enabled, and addedAt fields
  - Created src/lib/guardrails.ts with loadGuardrails, saveGuardrails, addGuardrail, removeGuardrail, toggleGuardrail, and getActiveGuardrails functions
  - Added GUARDRAILS_FILE_PATH constant to src/lib/paths.ts
  - Added DEFAULT_GUARDRAILS with essential guardrails: verify before commit, read existing patterns, fix build before proceeding
  - Updated buildPrompt() to inject active guardrails into the prompt under a "## Guardrails" section
  - Added 'ralph guardrails' CLI command with list, add, remove, and toggle subcommands
  - Added '/guardrail <instruction>' slash command for quick guardrail addition during sessions
  - Added '/guardrails' slash command to open the guardrails management view
  - Created GuardrailsView component for interactive guardrail management in the terminal UI

- 3826baa: Add service container and bootstrap infrastructure for dependency injection

  - Create ServiceContainer interface with ConfigService and PrdService
  - Add initializeServices(), getServices(), resetServices(), and isInitialized() functions
  - Add convenience accessors getConfigService() and getPrdService()
  - Create bootstrapServices() for production and bootstrapTestServices() for testing
  - Bootstrap services at application startup in main()

- 540c3a5: Migrate SessionMemoryService to new service container architecture

  - Created self-contained session-memory service directory with types.ts, validation.ts, formatters.ts, and implementation.ts
  - Added SessionMemoryService to ServiceContainer with getSessionMemoryService() accessor
  - Updated all consumers to use the service container pattern instead of direct imports
  - Moved SessionMemory type from session.types.ts to service's types.ts
  - Moved isSessionMemory type guard from type-guards.ts to service's validation.ts
  - Added closure-based caching in createSessionMemoryService factory function
  - Removed legacy src/lib/session-memory.ts file

- 8fa2bf0: Implement session memory for cross-session learning

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

- 3e1c69a: Implement task decomposition request handling

  - Add DECOMPOSITION_MARKER constant for agent to signal task decomposition
  - Create DecompositionRequest and DecompositionSubtask types in prd.types.ts
  - Update buildPrompt() to include decomposition instructions for the agent
  - Create src/lib/decomposition.ts with parseDecompositionRequest() and applyDecomposition() functions
  - Add maxDecompositionsPerTask config option (default: 2) to prevent infinite decomposition loops
  - Update orchestrator to detect decomposition marker and apply subtasks to PRD
  - Add restartCurrentIteration() to iteration store for seamless decomposition handling
  - Add decomposition logging to iteration logs with IterationLogDecomposition type
  - Add 'decomposed' status to IterationLogStatus
  - Display decomposition feedback in IterationProgress component
  - Log decomposition events to progress.txt

- 8fcdb03: Add verification phase after each iteration

  - Added VerificationConfig interface with buildCommand, testCommand, lintCommand, customChecks, and failOnWarning options
  - Created src/lib/verification.ts with runVerification() and runCheck() functions
  - Orchestrator now runs verification after agent completes (before marking iteration as done)
  - If verification fails, iteration status is set to 'verification_failed' and triggers retry
  - Added verification results to iteration logs (IterationLogVerification)
  - Added --skip-verification CLI flag to bypass verification checks
  - Added verification status display in IterationProgress component
  - Verification results are logged to progress.txt

### Patch Changes

- 7cb7f88: Add /refresh slash command to reload PRD from disk and update UI state
- 2054961: Clear terminal when exiting ralph
- 972edb6: Verified cleanup of legacy files and types after service migration
- 94add0c: Migrate ConfigService to new self-contained service architecture

  - Created src/lib/services/config/ directory with types.ts, validation.ts, constants.ts, formatter.ts, and implementation.ts
  - Moved RalphConfig, AgentType, NotificationConfig, MemoryConfig, VerificationConfig, ConfigValidationError, ConfigValidationResult to service types
  - Moved isRalphConfig, isPartialRalphConfig, validateConfig to service validation
  - Moved config constants and defaults to service constants
  - Updated bootstrap to use createConfigService factory function
  - Updated all re-exports through services/index.ts
  - Deleted legacy ConfigService.ts, config/ directory, and constants/config.ts

- 7598e21: Migrate GuardrailsService to new architecture

  - Created src/lib/services/guardrails/ directory with self-contained service files
  - Created types.ts with PromptGuardrail, GuardrailTrigger, GuardrailCategory, AddGuardrailOptions, GuardrailsFile interfaces and GuardrailsService interface
  - Created validation.ts with isPromptGuardrail, isGuardrailsFile type guards
  - Created defaults.ts with createDefaultGuardrails function
  - Created formatters.ts with formatGuardrailsForPrompt function
  - Created implementation.ts with createGuardrailsService factory function using closure-based caching
  - Updated container.ts to add GuardrailsService to ServiceContainer and getGuardrailsService() accessor
  - Updated bootstrap.ts to create GuardrailsService instance and add mock for tests
  - Updated index.ts to re-export all guardrails types, constants, formatters, and validation functions
  - Updated all consumers (prompt.ts, guardrails.ts CLI command, useSlashCommands.ts, GuardrailsView.tsx, AnalyzeView.tsx)
  - Updated test files to use bootstrapTestServices() with real GuardrailsService
  - Removed PromptGuardrail, GuardrailTrigger, GuardrailCategory from src/types/config.types.ts
  - Removed isGuardrailsFile from src/lib/type-guards.ts
  - Re-exported guardrails types from src/types/index.ts via services
  - Updated src/lib/constants/defaults.ts to re-export createDefaultGuardrails from service
  - Deleted src/lib/guardrails.ts
  - All 414 tests pass

- 16ccc3e: Migrate PrdService to new service architecture

  - Created src/lib/services/prd/ directory with self-contained service files
  - Created types.ts with Prd, PrdTask, LoadPrdResult, DecompositionSubtask, DecompositionRequest, TaskWithIndex, CanWorkResult interfaces and PrdService interface
  - Created validation.ts with isPrd, isPrdTask type guards
  - Created implementation.ts with createPrdService factory function using closure-based caching
  - Updated container.ts to import PrdService from ./prd/types.ts
  - Updated bootstrap.ts to use createPrdService() instead of singleton
  - Updated index.ts to re-export all PRD types, validation functions
  - Updated src/lib/prd.ts facade to re-export from new service location
  - Updated src/types/index.ts to export PRD types from services
  - Removed Prd, PrdTask, LoadPrdResult, DecompositionSubtask, DecompositionRequest from src/types/prd.types.ts
  - Removed isPrd, isPrdTask from src/lib/type-guards.ts
  - Updated src/lib/integrity.ts to import isPrd from new location
  - Updated InitWizard.tsx and AddTaskWizard.tsx to import isPrd/isPrdTask from services
  - Deleted src/types/prd.types.ts
  - Deleted src/lib/services/PrdService.ts (old singleton)
  - All 414 tests pass

- 81d3870: Migrate SessionService to new service architecture

  - Created src/lib/services/session/ directory with self-contained service files
  - Created types.ts with Session, SessionStatus, SessionStatistics, IterationTiming interfaces and SessionService interface
  - Created validation.ts with isSession, isSessionStatus type guards
  - Created implementation.ts with createSessionService factory function using closure-based caching
  - Updated container.ts to add SessionService to ServiceContainer and getSessionService() accessor
  - Updated bootstrap.ts to create SessionService instance and add mock for tests
  - Updated index.ts to re-export Session, SessionService, SessionStatus types
  - Updated all consumers (orchestrator.ts, appStore.ts, daemon.ts, CLI commands, useSlashCommands.ts)
  - Updated test files to use the new service
  - Removed Session types from src/types/session.types.ts
  - Removed isSession from src/lib/type-guards.ts
  - Deleted src/lib/session.ts

- c2ae916: Fix claude and cursor commands
- cebb465: Add automatic update check on startup with non-intrusive UI notification

  - Added `checkForUpdateOnStartup()` function in update.ts that checks for updates respecting the 24-hour interval and skipped versions
  - Added update status tracking to appStore (updateAvailable, latestVersion, updateBannerDismissed)
  - Created UpdateBanner component that displays a subtle notification when an update is available
  - Added `/dismiss-update` slash command to hide the update banner for the current session
  - Integrated update check into useSessionLifecycle hook to run on startup
  - Updated HelpView to document the new `/dismiss-update` command

## 0.9.0

### Minor Changes

- 742ca40: Add Codex agent support

  - Added 'codex' to the AgentType union type
  - Added Codex to VALID_AGENTS array
  - Added Codex CLI command configuration: ['codex', '-q', '--approval-mode', 'full-auto']
  - Added Codex option to SetupWizard agent selection
  - Updated IterationLogAgent type to use AgentType instead of hardcoded union

### Patch Changes

- 3220643: Refactor: Simplify RunApp component by extracting hooks and ViewRouter

  - Extract useSlashCommands hook for slash command handling logic
  - Extract useSessionLifecycle hook for session-related effects
  - Create ViewRouter component for view switching logic
  - Create MainRunView component for the main run view content
  - Reduce RunApp from 310+ lines to ~150 lines with better separation of concerns

- ecf8ddb: Refactor: Split config.ts into focused modules

  - Created src/lib/config/ directory with focused submodules:
    - constants.ts: CONFIG_DEFAULTS, AGENT_COMMANDS, VALID_AGENTS, etc.
    - loader.ts: loadConfig, saveConfig, loadGlobalConfig, etc.
    - validator.ts: validateConfig and all validation helpers
    - formatter.ts: formatValidationErrors, getConfigSummary, formatMs, formatBytes
    - index.ts: re-exports everything for backward compatibility
  - Updated src/lib/config.ts to re-export from config/index.ts
  - All existing imports from @/lib/config continue to work unchanged

## 0.8.1

### Patch Changes

- 2a9f49c: Centralize path constants into src/lib/paths.ts for better maintainability
- a6535e9: Add ConfigService and PrdService singleton classes to cache config and PRD reads, eliminating repeated disk reads for improved performance and consistency
- 72f738a: Consolidate session lifecycle management in orchestrator

  - Moved session creation logic from appStore.startIterations() to orchestrator.startSession()
  - Moved session resume logic from appStore.resumeSession() to orchestrator.resumeSession()
  - Moved fatal error handling from appStore.handleFatalError() to orchestrator.handleFatalError()
  - Simplified appStore methods to only manage UI state and delegate session lifecycle to orchestrator
  - Added StartSessionResult and ResumeSessionResult types to orchestrator for better type safety
  - Orchestrator now emits session events (session:start, session:resume, session:stop) centrally

- 882d3f4: Consolidate type exports to single canonical path (@/types)

  - Remove type re-exports from src/lib/config.ts (ConfigValidationError, ConfigValidationResult)
  - Remove type re-exports from src/lib/prd.ts (LoadPrdResult)
  - Remove type re-exports from src/stores/appStore.ts (ActiveView, AppState, SetManualTaskResult, ValidationWarning)
  - Update src/stores/index.ts to re-export types from @/types instead of appStore

- 6f165bf: Refactor: Encapsulate module-level mutable state in service classes

  - Create AgentProcessManager service to manage process, abort state, and retry count
  - Create IterationTimer service to manage delay timeouts and project completion state
  - Update agentStore to use AgentProcessManager instead of module-level refs
  - Update iterationStore to use IterationTimer instead of module-level refs

- 1506576: Introduce event bus to decouple stores

  - Create typed EventEmitter class in src/lib/events.ts with events for agent, iteration, and session lifecycle
  - Update agentStore to emit events instead of directly calling other stores
  - Update iterationStore to emit iteration lifecycle events
  - Update orchestrator to subscribe to event bus and coordinate between stores
  - Update appStore to emit session lifecycle events
  - Remove direct cross-store getState() calls from agentStore (orchestrator now coordinates)

- 1104b27: Extract duplicated getCurrentTaskIndex utility to src/lib/prd.ts

## 0.8.0

### Minor Changes

- fc2c48b: Add comprehensive test suite with unit and integration tests for lib functions, CLI commands, and hooks. Tests cover config validation, PRD operations, prompt generation, version comparison, error handling, CLI argument parsing, and formatters. Includes test coverage reporting via `bun test --coverage`.
- 1a9f8a2: Add max runtime limit configuration

  - Added `maxRuntimeMs` config option to set a maximum total runtime after which Ralph stops gracefully
  - Added `--max-runtime <seconds>` CLI flag to set runtime limit from command line
  - Display time remaining in status bar when a runtime limit is set
  - Useful for time-boxed overnight runs

### Patch Changes

- c1c5a29: Fix stop command not working in some cases
- 08a682b: Fix UI offset caused by agent output stream on iteration completion

  - AgentOutput component now returns null when there's no content to display, preventing empty boxes from causing layout shifts
  - Agent state is now properly reset on iteration completion instead of only on iteration start, ensuring clean state between iterations

- c21a1b5: Improve error messages and user feedback throughout the application

  - Add comprehensive error codes system (E001-E999) for programmatic error handling
  - Add --verbose flag to CLI for detailed error output with suggestions
  - Improve config validation errors with field-specific hints and examples
  - Enhance agent errors with actionable suggestions for common issues
  - Add better task lookup error messages showing available tasks
  - Include error codes and suggestions in JSON output for list/config commands

- b1ed350: Add iteration statistics and reporting functionality. Track and display statistics about runs including time per task, success rates, and total elapsed time. Added `ralph stats` CLI command to view statistics.
- 06fd274: Allow resume after stop
- 53b4fd1: Add comprehensive troubleshooting documentation to README including common error scenarios, FAQ section, configuration options with examples, example PRDs for different project types, and performance tuning recommendations

## 0.7.1

### Patch Changes

- e50cfce: Add Linux support to update system - extend getOperatingSystem to support linux platform and add Linux binaries to build configuration
- 674b21b: Show status instead of agent stream preview while agent is working
- 289671a: Remove obsolete warning if progress.txt is missing from current ralph directory
- 674b21b: Fix broken progress file write

## 0.7.0

### Minor Changes

- caece1a: Dedicated logs folder and improved log persistence
- c3ac7e0: Archive completed tasks and progress on session start
- e638604: Remove dependency definition in PRD
- f03120d: Add archive command

### Patch Changes

- 67f0c8f: Fix performance issues with long running sessions

## 0.6.2

### Patch Changes

- 576b862: Initialize .ralph with gitignore
- cb86792: Check integrity on startup
- 2faa2fe: Change install directory and add migration util

## 0.6.1

### Patch Changes

- 26ce7db: Make /status command available within ralph
- e2b1f47: Fix task creation result parsing
- c4f7397: Fix command interface not applying inputs properly

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
