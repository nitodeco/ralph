# ralph

## 0.14.2

### Patch Changes

- 6746754: Fix github flow

## 0.14.1

### Patch Changes

- 0b68018: Fix ralph logo responsiveness threshold

## 0.14.0

### Minor Changes

- 99d7585: Added inline task editing in TasksView
- 85326b3: Add config and GitHub integration management via slash commands

  Added new slash commands and CLI functionality:

  - /config - View current configuration settings in the Terminal UI
  - /github - Interactive GitHub integration setup (token, PR settings)
  - ralph github - CLI command to view/manage GitHub settings
  - ralph github set-token - Set GitHub personal access token
  - ralph github clear-token - Remove GitHub token

  The ConfigView displays all effective configuration including agent settings,
  retry/timeout settings, notifications, memory management, and git provider config.

  The GitHubSetupView provides a menu-driven interface for:

  - Setting/updating GitHub personal access token (masked display)
  - Toggling auto-create PR on task completion
  - Toggling PR draft mode
  - Clearing stored token

- 4e2a400: Consolidate session-related commands under /session namespace

  - Session control commands now use `/session <subcommand>` format:
    - `/session start [n|full]` - Start agent loop
    - `/session stop` - Stop the running agent
    - `/session resume` - Resume interrupted session
    - `/session pause` - Pause the current session (new)
    - `/session clear` - Clear session data
    - `/session refresh` - Reload PRD from disk
    - `/session archive` - Archive completed tasks
  - Removed top-level `/start`, `/stop`, `/resume`, `/clear`, `/refresh`, `/archive` commands
  - Added new `/session pause` command to pause without stopping
  - Updated help text across CLI and TUI to reflect new command structure

- ff5344b: Added first-run safety consent warning
- 7a2ee42: Added branch mode workflow for isolated task branches
- 6b41edb: Added git provider interface for PR operations
- 7414213: feat: add OAuth device flow authentication for GitHub

  - Added new `ralph auth` command with subcommands:

    - `ralph auth login` - Initiate GitHub OAuth device flow authentication
    - `ralph auth logout` - Revoke tokens and clear credentials
    - `ralph auth status` - Show current authentication status

  - Updated GitHub integration to use OAuth tokens when available, falling back to PAT
  - Added `/auth` slash command in terminal UI for OAuth authentication
  - Updated `/github` view with OAuth login option alongside PAT setup
  - Enhanced `ralph github` command to show authentication method (OAuth vs PAT)
  - Added migration prompts for existing PAT users to switch to OAuth
  - OAuth tokens are stored securely in global config alongside existing settings

- 155e9fd: Added GitHub provider for automatic PR creation
- 5ec56dd: Added global rules support with `--global` flag
- b33739d: Integrated automatic PR creation into branch mode

### Patch Changes

- 1b011ec: Added Escape key support to exit the /add command input, allowing users to cancel task creation during the description step
- cec5b59: Fix slash command hint navigation with arrow keys. When typing a partial slash command, the suggestion list now properly follows the selected item using viewport windowing. Previously, navigating past the 5th suggestion would leave the selection indicator invisible because the selected item was outside the displayed window. Now, the window scrolls to keep the selected item visible, showing indicators for items above and below the viewport.
- ce2a4a6: Fix memory leaks in long-running sessions by using rolling buffers and releasing stream locks
- 52dc55d: Fixed text input race conditions when typing quickly
- 00b9da7: Hide iteration progress bar when in idle state

  - The iteration progress bar is now only shown when a session is running, complete, or stopped at max iterations/runtime
  - In idle state (before starting a session), the progress bar is hidden for a cleaner UI

- 3e938d2: Render /help output inline in the main view instead of navigating to a separate full-screen view. The help content can be dismissed by pressing Escape or by typing /help again to toggle it off.
- b6d85af: Add shorthand slash commands /q and /e as aliases for /quit and /exit
- 36d7384: Unified Rules and Tasks views with shared list-detail components

  - Added SelectableList component for generic list navigation with selection indicator
  - Added DetailPanel component for bordered detail display panels
  - Added useListNavigation hook for shared keyboard navigation logic
  - Refactored TasksView to use shared components (SelectableList, DetailPanel, useListNavigation)
  - Refactored RulesView to use shared components with consistent UX patterns
  - Extracted smaller subcomponents for better code organization and reusability

## 0.13.0

### Minor Changes

- e259393: feat: add auto-guardrail generation from codebase analysis

  Added a new `ralph guardrails generate` command that analyzes the current project's codebase and automatically generates relevant guardrails based on detected patterns.

  ## Features

  - Detects package manager (npm, yarn, pnpm, bun)
  - Detects TypeScript usage
  - Detects test frameworks (jest, vitest, mocha, bun test)
  - Detects linters (eslint, biome)
  - Detects formatters (prettier, biome)
  - Detects frameworks (React, Next.js, Vue, Svelte, Angular)
  - Detects build tools (Vite, Webpack, esbuild, Parcel)
  - Detects git hooks (husky, lint-staged, lefthook)
  - Detects CI configuration (GitHub Actions, GitLab CI, CircleCI, etc.)
  - Detects monorepo configurations (workspaces, pnpm-workspace, turbo, nx, lerna)
  - Detects npm scripts (build, test, lint, format, typecheck)

  ## Usage

  ```bash
  # View suggested guardrails without applying
  ralph guardrails generate

  # View as JSON
  ralph guardrails generate --json

  # Generate and immediately add guardrails
  ralph guardrails generate --apply
  ```

- 8ae9bb2: feat: add /usage command to terminal UI

  Added new /usage slash command that opens an interactive view displaying:

  - Summary tab with lifetime statistics (sessions, iterations, tasks, success rate, streaks)
  - Sessions tab showing recent session history with status indicators
  - Daily tab showing aggregated daily usage metrics

  The view uses tab navigation with arrow keys and matches the existing UI patterns.

- 86ee029: Add better progress indicators with informative spinners and progress bars

  - Enhanced Spinner component with 9 context-aware variants (default, processing, waiting, success, warning, error, thinking, network, progress) using different cli-spinners animations
  - Enhanced ProgressBar component with 4 style options (default, minimal, detailed, compact), auto-color mode, and configurable display options (count, bytes, suffix)
  - Added PhaseIndicator component with 4 visualization styles (dots, timeline, compact, minimal) showing agent execution phase progress
  - Updated IterationProgress with ETA calculation, elapsed time display, average iteration time, and enhanced visual feedback
  - Updated AgentStatus with phase-specific spinner variants, visual phase timeline, and color-coded file change indicators
  - Updated PlanGeneratingPhase to use thinking spinner variant

- 4ecd4c6: Add CLI-based task operations for /plan command

  - Add `ralph task add` command to add new tasks via `--stdin` JSON or flags
  - Add `ralph task edit <n>` command to edit existing tasks (partial updates, preserves done status)
  - Add `ralph task remove <n>` command to remove tasks by index
  - Add `ralph task show <n>` command to display full task details (description, steps)
  - Update `/plan` prompt to show full task content and instruct AI to use CLI commands
  - Add command parser to extract task operations from AI output instead of parsing JSON
  - Prevents task content degradation by only touching tasks relevant to the specification

- f32d673: Add command history with arrow key navigation. Commands entered in the Terminal UI are now persisted and can be navigated using up/down arrow keys. History is stored per-project and shows a visual indicator when browsing previous commands.
- e13fce8: Add confirmation dialogs for destructive actions

  - Created reusable `ConfirmationDialog` component in `src/components/common/`
  - Added confirmation dialog to `MemoryView` when pressing 'c' to clear all session memory
  - Added confirmation dialog to `GuardrailsView` when pressing 'd' to delete a guardrail
  - Added `ConfirmClearView` for the `/clear` slash command with session summary
  - Added `--force` (or `-f`) flag to `ralph clear` CLI command to skip confirmation
  - Added `--force` flag to `ralph memory clear` CLI command to skip confirmation
  - CLI commands now show interactive readline prompts for confirmation when not using `--force`

- ac23359: feat: add CLI commands for dependency management

  Added new `ralph dependency` command with subcommands:

  - `dependency` / `dependency graph` - Show dependency graph for all tasks
  - `dependency validate` - Validate task dependencies (detect cycles, missing refs)
  - `dependency ready` - List tasks ready for execution (dependencies satisfied)
  - `dependency blocked` - List tasks blocked by incomplete dependencies
  - `dependency order` - Show parallel execution groups in order
  - `dependency show <task>` - Show dependency details for a specific task
  - `dependency set <task> <dep1> [dep2...]` - Set dependencies for a task
  - `dependency add <task> <dep>` - Add a dependency to a task
  - `dependency remove <task> <dep>` - Remove a dependency from a task

  All commands support `--json` flag for programmatic output.

- 3231ee7: feat: enhanced agent status display with phase detection

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

- 6cf1098: Add parallel task execution tracking to session management

  - Added new types for parallel execution: `TaskExecutionStatus`, `ActiveTaskExecution`, `ParallelExecutionGroup`, and `ParallelSessionState`
  - Extended `Session` interface with optional `parallelState` field
  - Extended `IterationLog` with `isParallelExecution` and `parallelGroup` fields for tracking parallel task executions
  - Added new types `ParallelTaskExecution` and `IterationLogParallelGroup` for logging parallel task execution details
  - Added 14 new methods to `SessionService` for parallel execution management:
    - `enableParallelMode` / `disableParallelMode` / `isParallelMode` for mode control
    - `startParallelGroup` / `completeParallelGroup` / `getCurrentParallelGroup` for group management
    - `startTaskExecution` / `completeTaskExecution` / `failTaskExecution` / `retryTaskExecution` for task lifecycle
    - `getActiveExecutions` / `getTaskExecution` / `isTaskExecuting` / `getActiveExecutionCount` for querying state
  - Added comprehensive validation for parallel session state
  - Added 39 unit tests for parallel session tracking functionality

- 04d9f33: Add idempotent operations to prevent duplicate work

  - Create idempotency module with content hashing, atomic file writes, operation tracking, debounced writers, and batched updaters
  - Update SessionService, PrdService, iteration-logs, ConfigService, GuardrailsService, SessionMemoryService, FailurePatterns, and ProjectRegistry to use idempotent file writes
  - Atomic file operations (write-to-temp, rename) ensure data integrity
  - Content hash-based change detection skips unnecessary writes
  - Operation tracker prevents duplicate work with TTL-based cleanup
  - Add 43 unit tests for the idempotency module

- e7e172a: Add multi-process support to AgentProcessManager for parallel task execution

  - Changed from single-process to Map-based multi-process tracking
  - Added process identifier support for managing multiple concurrent agent processes
  - New methods: registerProcess, unregisterProcess, getProcessById, getAllProcessIds, getAllProcessInfo, getActiveProcessCount, isAnyRunning, killAll, resetAll, clearAllForceKillTimeouts
  - Maintained backward compatibility with existing single-process API by using a default process identifier
  - Added per-process state tracking: aborted, retryCount, forceKillTimeout, createdAt
  - Added global abort state that affects all processes
  - Exported ProcessEntry and ProcessInfo types for external use

- dbd9095: feat: add parallel task scheduling to SessionOrchestrator

  Added parallel execution capabilities to the orchestrator:

  - New `ParallelExecutionConfig` interface for configuring parallel mode
  - `initializeParallelExecution()` method to validate dependencies and compute parallel groups
  - `startNextParallelGroup()` to begin executing a group of independent tasks
  - `recordParallelTaskStart()` and `recordParallelTaskComplete()` for tracking individual task progress
  - `getParallelExecutionSummary()` for monitoring parallel execution status
  - Integration with SessionService parallel tracking methods
  - New events: `parallel:group_start`, `parallel:group_complete`, `parallel:task_start`, `parallel:task_complete`
  - Comprehensive test coverage with 14 tests

  This enables ralph to execute multiple independent tasks in parallel when configured, improving throughput for PRDs with independent tasks or tasks organized with dependency metadata.

- 50a84a0: Align all terminal UI with ResponsiveLayout fixed layout system
- 757b34f: Add responsive terminal layout support for narrow terminals

  - Added `useTerminalDimensions` hook for detecting terminal width/height and breakpoints
  - Created `ResponsiveLayout` component that provides responsive context to child components
  - Updated `Header` component with three variants: `full` (default), `compact`, and `minimal`
  - Updated `StatusBar` with responsive variants that adapt to terminal width
  - Updated `PhaseIndicator` with auto-style selection based on terminal width
  - Updated `IterationProgress` with responsive progress bar width and condensed display for narrow terminals
  - Breakpoints: narrow (≤60 cols), medium (61-100 cols), wide (>100 cols)

- 44a4f2b: Add /rules command for managing custom instructions

  This adds a new command for managing custom rules (instructions) that are injected into the agent prompt. Rules are simpler than guardrails - they are just text instructions without triggers or categories.

  Features:

  - CLI: `ralph rules [list|add|remove]`
  - Slash commands: `/rules` (view), `/rule <text>` (add)
  - Terminal UI: Interactive RulesView with add/delete/navigate
  - Stored per-project in `rules.json`

- ebccb9b: feat: add Default/Advanced mode selection to setup wizard

  The setup wizard now offers two configuration modes:

  - Default (Recommended): Only asks for the AI agent type and uses sensible defaults for all other settings
  - Advanced: Goes through all configuration options as before (retries, timeouts, memory, notifications)

  This makes the initial setup faster for users who just want to get started quickly.

- 05e9a95: Add slash command autocomplete hints with keyboard navigation

  - Display command suggestions above the input when typing `/`
  - Filter suggestions dynamically as user continues typing
  - Use Tab or ArrowRight (at end of input) to autocomplete the top result
  - Use ArrowUp/ArrowDown to navigate through suggestions
  - Visual highlighting shows the currently selected suggestion with a `▸` indicator
  - Show command description alongside each suggestion for better discoverability

- 081ce0b: Add system notifications for user input events

  - Add new notification event types: input_required, session_paused, verification_failed
  - Send session_paused notification when user stops the session
  - Send verification_failed notification when verification checks fail
  - All notifications respect the systemNotification config setting

- 0c59184: feat: add post-run technical debt review

  Implemented automatic technical debt review at session completion:

  - Created TechnicalDebtHandler that analyzes iteration logs for quality issues
  - Detects retry patterns, verification failures, decomposition frequency, error patterns, and performance issues
  - Generates structured reports with severity levels (critical/high/medium/low)
  - Provides actionable recommendations based on detected issues
  - Added TechnicalDebtReviewConfig to RalphConfig for customization
  - Integrated into orchestrator's onAllComplete callback
  - Added session:technical_debt_review event for external integrations
  - Report is automatically appended to progress file when issues are found

- b1abc83: feat: add vim-like editing to PRD text input

  Added vim-like editing capabilities to the TextInput component:

  - Normal mode (Esc) and Insert mode (i, a, A, I)
  - Navigation: hjkl, word motions (w, b, e), line motions (0, $, ^)
  - Delete operations: x, X, d+motion (dw, db, dd, d$, d0), D, C
  - Undo support (u)
  - Visual vim mode indicator showing [N] for normal mode and [I] for insert mode
  - Block cursor highlighting in normal mode

  The PlanInputPhase component now uses vim mode by default. Users can navigate
  and edit their PRD specifications using familiar vim keybindings.

### Patch Changes

- 95c8332: Add failsafes and error handling to agent loop

  - Add try-catch around stream reading operations to prevent crashes from stream read failures
  - Add safe decoder handling for invalid UTF-8 data with graceful fallback
  - Add timeout protection (30s) for process exit to prevent infinite hangs
  - Add error isolation for event handlers in orchestrator to prevent cascading failures
  - Add process state validation in AgentProcessManager to detect desynchronization
  - Add error handling for output handler callbacks to prevent callback errors from crashing stream reading
  - Add new error codes: AGENT_STREAM_ERROR, AGENT_PROCESS_HANG, AGENT_DECODE_ERROR
  - Wrap retry context generation in try-catch with fallback to retry without context
  - Wrap verification handler, learning handler, and iteration log operations in try-catch

- bae074e: feat: add cross-session usage statistics tracking

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

- ffaf819: feat: add task dependency graph engine

  Implements a comprehensive dependency graph engine for analyzing and managing task dependencies in PRDs. The engine provides:

  - `buildDependencyGraph`: Constructs a directed graph from task dependencies
  - `validateDependencies`: Validates dependencies for missing refs, cycles, and self-references
  - `detectCycles`: Detects circular dependencies using DFS
  - `getTopologicalOrder`: Returns tasks sorted in dependency order
  - `getReadyTasks`: Returns tasks that have all dependencies satisfied
  - `getBlockedTasks`: Returns tasks waiting on incomplete dependencies
  - `getNextReadyTask`: Returns the highest priority ready task
  - `canExecuteTask`: Checks if a specific task can be executed
  - `getExecutionOrder`: Returns the order tasks should be executed
  - `getParallelExecutionGroups`: Groups tasks that can run in parallel

  This engine enables parallel task execution by identifying which tasks can run concurrently based on their dependency relationships.

- 76f2d76: Extracted magic numbers into named constants for improved code readability and maintainability. Constants now include timeout values, progress thresholds, display widths, and delay configurations.
- 35d2343: Fixed slash command completion keyboard navigation where arrow keys now properly select and apply the highlighted suggestion
- fa6c1de: fix: reset iteration count when clearing session via /clear command
- a42b2a1: Fix Ctrl+Enter keybind not working when editing task after PRD generation. The TextInput component was consuming all Enter key events, including Ctrl+Enter, preventing the parent handler from processing the save action. Now TextInput explicitly allows Ctrl+Enter and Meta+Enter events to propagate to parent handlers.
- 2f2d6d6: Fix layout shift in plan review view when switching between edit and details modes
- 0f5a32d: Fix task list scrolling in PlanReviewPhase for condensed terminal views. Implements viewport windowing to ensure the selected task is always visible when navigating with arrow keys. Shows 5 tasks in narrow terminals vs 8 in normal view, with scroll indicators showing items above/below the viewport.
- e2128cc: Fix terminal UI after session resume - iteration counter now correctly continues from where it left off instead of resetting to 1
- ce0c5ba: fix: setup wizard no longer repeats on every start

  The globalConfigExists() function now directly checks the file system instead of going through the service container. This ensures the setup wizard correctly detects an existing config file regardless of service initialization state.

- f5ec186: Fixed /start full command to continue running until all tasks are complete. Previously, when running in full mode, the session would stop when the initial iteration count (based on incomplete tasks) was reached, even if tasks hadn't been completed due to retries, verification failures, or decomposition. Now the iteration limit automatically extends when there are still pending tasks.
- e6399cb: Fix text input character loss during fast typing by using refs to track the latest value and cursor position
- 410c366: feat: implement fixed terminal UI layout system

  Adds a stable terminal UI layout that maintains consistent positioning:

  - New FixedLayout component divides the terminal into header, content, and footer regions
  - New ScrollableContent component wraps the content area with overflow handling
  - StatusBar and CommandInput stay anchored at the bottom regardless of content changes
  - Terminal resize events are handled to recalculate layout dimensions
  - Refactored MainRunView to use the new layout system for improved stability

- 53c206e: Add memory leak prevention for long-running sessions

  - Fix timeout leak in AgentProcessManager.safeKillProcess by tracking and clearing pending kill timeouts
  - Add clearCallbacks and reset methods to iterationStore to prevent closure accumulation
  - Add reset method to createThrottledFunction utility for proper timeout cleanup
  - Clear iteration callbacks in orchestrator cleanup to prevent closure leaks between sessions
  - Add getListenerCount and getListenerStats methods to eventBus for memory debugging
  - Add performSessionCleanup function for comprehensive session resource cleanup
  - Add getMemoryDiagnostics function for debugging memory and resource state

- 0dbe1ac: feat: add dependency metadata fields to PrdTask type

  The PrdTask type now includes optional fields for task dependency management:

  - `id`: Optional unique identifier for referencing tasks in dependencies
  - `dependsOn`: Optional array of task IDs that must complete before this task
  - `priority`: Optional number for scheduling priority (lower = higher priority)

  The DecompositionSubtask type has also been updated to support these fields when decomposing tasks. All fields are optional to maintain backward compatibility with existing PRD files.

- 953e933: Add quit functionality to plan command input phase

  Users can now press `q` in vim normal mode (press Esc first) to quit from the plan command input phase. This follows the same pattern as other phases where `q` or Esc can be used to cancel/exit.

- 7d7c424: chore: remove unused IterationLogHandler class
- 9bd3bc5: chore: remove unused plan-command-parser functions
- 7f80e83: chore: remove unused plan-parser functions
- 2621a4d: Replaced all switch statements with ts-pattern match expressions for consistent control flow throughout the codebase
- f551b10: Enhanced tab completion for slash commands with common prefix completion, Tab/Shift+Tab cycling through suggestions, and trailing spaces for commands with arguments
- b1ad96d: feat: add Ctrl+Home/End document start/end navigation to TextInput

  The TextInput component now supports Ctrl+Home and Ctrl+End for document-level cursor navigation:

  - Ctrl+Home moves the cursor to the beginning of the document (offset 0)
  - Ctrl+End moves the cursor to the end of the document (after the last character)

- fcbf291: feat: add Home/End key navigation for line start/end in TextInput

  The TextInput component now supports Home and End key navigation for moving the cursor to the start or end of the current line in multiline text:

  - Home key moves the cursor to the beginning of the current line
  - End key moves the cursor to the end of the current line

  This complements the existing up/down arrow line navigation for a more complete multiline editing experience.

- ec9ffa2: feat: add up/down arrow line navigation to TextInput component

  The TextInput component now supports navigating between lines in multiline text using the up and down arrow keys. When pressing up/down:

  - The cursor moves to the equivalent column position on the previous/next line
  - If the target line is shorter, the cursor is clamped to the end of that line
  - External onArrowUp/onArrowDown callbacks are only triggered when already at the first/last line

  This improves the multiline text editing experience when pasting or entering multi-line content.

- 9f99b6c: feat: add Ctrl+Left/Right word-by-word navigation to TextInput

  The TextInput component now supports Ctrl+Left and Ctrl+Right for word-by-word cursor navigation:

  - Ctrl+Left moves the cursor to the beginning of the previous word
  - Ctrl+Right moves the cursor to the end of the next word

  Word boundaries are determined by transitions between word characters (alphanumeric and underscore) and non-word characters.

## 0.12.0

### Minor Changes

- e0be4eb: Remove local `.ralph/` directory requirement - all project data now stored in `~/.ralph/projects/`

  - Projects are auto-registered on first use without requiring `ralph init`
  - Auto-migrate existing local `.ralph/` data to global location on startup
  - Fix macOS symlink path normalization (e.g., `/var` -> `/private/var`)
  - Remove migration prompt UI and related state management
  - Simplify `ralph migrate` command to only clean up local directories

### Patch Changes

- f4bd872: Fix exit command not clearing the console correctly

## 0.11.0

### Minor Changes

- 5219e1c: Add /plan command for AI-powered PRD generation

  - Add `/plan` slash command that generates a PRD from a free-form specification
  - Support intelligent merging with existing PRD tasks using title similarity matching
  - Show diff view with status indicators (+new, ~modified, -removed, unchanged)
  - Keyboard navigation (↑/↓) through tasks with detail panel
  - Accept (Enter/y) or cancel (q/Esc) generated changes
  - Preserve done status for matched existing tasks

- be2a18e: Add project management commands for viewing and managing registered Ralph projects

  - Added `ralph projects` CLI command to list all registered projects with name, path, type, and last accessed time
  - Added `ralph projects current` subcommand to show details about the current directory's project
  - Added `ralph projects prune` subcommand to remove orphaned projects with invalid paths
  - Added `--json` flag support for all projects commands for scripting
  - Added `/projects` slash command and interactive ProjectsView with keyboard navigation
  - ProjectsView features: list view with highlighting, detail view, remove project, prune orphaned projects

- 48fc585: Add sleep prevention using macOS caffeinate during active sessions
- 732854d: Update init flow to use global storage

  - InitWizard now registers projects in the global registry (~/.ralph/registry.json) before saving files
  - Project files are now stored in ~/.ralph/projects/<folder-name>/ instead of local .ralph directory
  - validateProject() now uses isProjectInitialized() from ProjectRegistryService
  - Success message shows the global storage path after initialization

- b23e74d: Ralph uses cli commands to view and modify the PRD and progress file
- 2b8e386: Add migration command and auto-migration prompt for global storage

  - Add `ralph migrate` CLI command to migrate local .ralph directory to global storage
  - Add `--remove` flag to delete local .ralph directory after successful migration
  - Add MigrationPromptView component that prompts users to migrate when a local .ralph directory is detected
  - Auto-detect migration needs on startup and show migration prompt
  - Add `/migrate` slash command for in-app migration
  - Migration copies all files (prd.json, session.json, progress.txt, logs/, archive/, etc.) to ~/.ralph/projects/
  - After migration, users can choose to keep or delete the local .ralph directory as a backup

- 5aa10a1: Add collapsible paste placeholders for long text in input fields

  - When users paste long text (multiline or over 80 characters), display as compact placeholder like "[Pasted text #1]"
  - Placeholders are displayed in dim cyan styling inline with regular text
  - Multiple pastes in the same input are numbered sequentially
  - Full pasted content is preserved and expanded on submission
  - Added to CommandInput, InitWizard, and AddTaskWizard description fields
  - Added isPasteLongEnough() and expandPastedSegments() utility functions with tests

- 6ab497a: Add /agent command to change preferred coding agent
- 7e7f04b: Add task checkboxes in plan review phase for selective acceptance

  - Tasks can now be individually toggled with Space key during review
  - New/modified/unchanged tasks are checked by default
  - Removed tasks are unchecked by default (must be checked to confirm removal)
  - Visual checkboxes (✓/○) show acceptance state for each task

### Patch Changes

- ac73d2c: Add cancellation during generation for plan, init, and add-task wizards. Users can now press Escape or 'q' to cancel generation and exit gracefully.
- 4c48114: Add task mutation functions to PRD library

  - Add toggleTaskDone function to toggle task done status
  - Add deleteTask function to remove tasks by index
  - Add reorderTask function to move tasks between positions
  - All functions follow immutable patterns (return new Prd objects)
  - Add comprehensive unit tests for all three functions

- 1759bf6: Add TasksView component with read-only interactive list

  - Create TasksView component for viewing all tasks in a navigable list
  - Display task title, done status (✓/○), and step count for each task
  - Show full task details (description, steps) for the selected task
  - Add keyboard navigation (↑/↓ arrows) and close shortcuts (q/Esc)
  - Export TasksView from views index

- 1a5c5fe: feat: convert path constants to registry-based functions

  - Added new constants: REGISTRY_PATH, PROJECTS_DIR, LOCAL_RALPH_DIR
  - Created new registry-based path functions: getSessionFilePath(), getPrdJsonPath(), getProgressFilePath(), getInstructionsFilePath(), getProjectConfigPath(), getGuardrailsFilePath(), getFailureHistoryFilePath(), getSessionMemoryFilePath(), getLogsDir(), getArchiveDir()
  - Added ensureProjectDirExists() for creating project directories in global storage
  - Kept deprecated constants (RALPH_DIR, LOGS_DIR, etc.) for backward compatibility during migration
  - Updated ensureLogsDirExists() to use getLogsDir()

- a85dc15: Add delete task functionality with confirmation to TasksView

  - Add 'x' key handler to enter delete confirmation mode
  - Show confirmation prompt with task title and red border
  - Handle Enter to confirm deletion, Escape to cancel
  - Adjust selected index after deletion to stay in bounds
  - Update help text to show 'x' key shortcut

- c1bd69f: Gracefully handle non-git repositories

  - Add isGitRepository() utility function in src/lib/paths.ts
  - Track git repository status in appStore.ts during project validation
  - Conditionally include commit instructions in agent prompts based on git availability
  - Warn users during dry-run validation when not in a git repository
  - Add tests for the new isGitRepository() function

- eb7d626: Add inline task editing in plan review phase. Users can now press 'e' to edit a selected task's title, description, and steps directly in the review phase. Use Tab/Shift+Tab to navigate between fields and Ctrl+Enter to save changes.
- 1eb35f0: Apply code style fixes to plan feature

  - Replace switch statement with ts-pattern match in PlanView
  - Replace forEach loops with for loops in plan-parser
  - Use descriptive variable names instead of single-letter abbreviations

- 4f23327: Add retry option in plan error phase

  - Add retry option (Enter/r) in the error phase to return to input and try again
  - Add exit option (q/Esc) to close the plan view after an error

- acba53e: Implement ProjectRegistryService for managing global project storage
- fdf2b9a: Add project registry types and resolution logic for global storage migration
- 503315e: Add task slash commands in terminal UI. Users can now use `/task done <id>`, `/task undone <id>`, `/task current`, and `/task list` to manage tasks directly from the command input without navigating to the tasks view.
- 25173f8: Add toggle done functionality to TasksView

  - Add 'd' key handler to toggle task completion status
  - Save updated PRD and refresh local state immediately
  - Display success message when task status changes
  - Update help text to show 'd' key shortcut

- 4bcc2c4: Update components and stores to use new registry-based path functions

  - Updated InitWizard.tsx to use getProgressFilePath(), getPrdJsonPath(), and ensureProjectDirExists() instead of deprecated constants
  - Updated appStore.ts to remove LOCAL_RALPH_DIR import and use a more generic error message
  - All 507 tests pass

- c9cbb51: Wire up /tasks command and view routing

  - Add 'tasks' to ActiveView type for view state management
  - Add 'tasks' to SlashCommand type and VALID_COMMANDS array
  - Handle 'tasks' command in useSlashCommands hook
  - Add TasksView routing in ViewRouter component

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
