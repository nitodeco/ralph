# ralph

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
