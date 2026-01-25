---
title: Sessions & Iterations
description: Understand how Ralph manages development sessions and executes iterations. Learn about session lifecycle, iteration flow, background mode, and session persistence for resumable workflows.
sidebar:
  order: 3
  label: Sessions & Iterations
---

# Sessions & Iterations

Ralph organizes work into **sessions** composed of **iterations**. A session is a continuous run through your PRD, and each iteration is a single AI agent execution. Understanding this model helps you configure Ralph effectively and troubleshoot issues.

## Sessions

A session represents one complete run through your PRD tasks. Think of it as a work session where Ralph orchestrates the AI agent to complete as many tasks as possible.

### Session Lifecycle

```
Start Session (ralph run)
    ↓
Initialize State
    ↓
┌─────────────────┐
│  Run Iteration  │ ← Repeat until done
└─────────────────┘
    ↓
Session Complete or Stopped
    ↓
Save Final State
```

### When Sessions Start

Sessions start when you run:

```bash
ralph run          # New session, 10 iterations
ralph run 20       # New session, 20 iterations
ralph resume       # Resume interrupted session
```

### When Sessions End

Sessions end when:

- All tasks are completed
- Iteration limit is reached
- You manually stop with `ralph stop` or `Ctrl+C`
- A fatal error occurs

### Session State

Ralph tracks session state in `~/.ralph/projects/<project>/session.json`:

```json
{
  "startedAt": "2024-01-20T10:00:00Z",
  "currentIteration": 5,
  "maxIterations": 10,
  "status": "running",
  "completedTasks": ["1", "2", "3"],
  "currentTask": "4",
  "errorHistory": []
}
```

This state allows Ralph to:
- Resume interrupted sessions
- Track progress across runs
- Provide context for retries
- Generate statistics

### Starting a Session

Start a new session with default settings:

```bash
ralph run
```

This runs 10 iterations by default. Specify a custom count:

```bash
ralph run 50
```

For long-running sessions, use background mode:

```bash
ralph run -b
# or
ralph run --background
```

### Checking Session Status

View current session state:

```bash
ralph status
```

Output:

```
Session Status:
  State: Running
  Iteration: 5 / 10
  Started: 15 minutes ago
  Elapsed: 15m 32s
  
Current Task:
  [4] Implement user login endpoint
  
Recent Progress:
  ✓ Set up Express server (3 minutes)
  ✓ Configure PostgreSQL (4 minutes)
  ✓ Create user schema (5 minutes)
  → Working on: Implement user login endpoint (3 minutes)
  
Agent:
  Status: Running
  Last output: 12 seconds ago
```

### Resuming a Session

If a session is interrupted (crash, manual stop, system restart), resume it:

```bash
ralph resume
```

Ralph restores the exact state:

```
✓ Restored session from 2 hours ago
→ Resuming at iteration 6 / 20
→ Current task: [5] Add authentication middleware
```

### Stopping a Session

Gracefully stop a running session:

```bash
ralph stop
```

Or press `Ctrl+C` if running in the foreground.

Ralph saves state before exiting:

```
⚠ Stopping session...
✓ Saved session state
✓ Session can be resumed with: ralph resume
```

## Iterations

An iteration is a single execution of your AI agent working on one task. Each iteration follows a structured flow.

### The Iteration Flow

```
┌─────────────────────────────────────────────────┐
│ 1. Prepare Context                              │
│    • Read current task                          │
│    • Load progress notes                        │
│    • Load guardrails                            │
│    • Load custom instructions                   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Spawn AI Agent                               │
│    • Launch agent process (cursor/claude/codex) │
│    • Pass task and context                      │
│    • Start monitoring                           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Monitor Execution                            │
│    • Stream agent output                        │
│    • Watch for completion signals               │
│    • Detect stuck states                        │
│    • Check timeouts                             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Handle Outcome                               │
│    • Success: Mark task done, commit changes    │
│    • Failure: Retry with context               │
│    • Decompose: Split task into subtasks       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 5. Move to Next Iteration                       │
└─────────────────────────────────────────────────┘
```

### What Happens in an Iteration

1. **Context Preparation**
   
   Ralph gathers everything the agent needs:
   ```bash
   # Ralph runs these commands internally
   ralph task current    # Get next task
   ralph progress       # Get progress notes
   # Load guardrails and instructions
   ```

2. **Agent Invocation**
   
   Ralph spawns the agent with a structured prompt:
   ```
   You are working on task: [3] Create user authentication schema
   
   Context:
   - Previous tasks completed: Set up Express, Configure PostgreSQL
   - Progress notes: Database connection configured, migrations ready
   
   Guardrails:
   - Use Prisma for database operations
   - Follow existing code patterns
   
   Instructions:
   - When complete, run: ralph task done 3
   - Add progress notes: ralph progress add "description"
   ```

3. **Monitoring**
   
   Ralph watches the agent's execution:
   - Streams output in real-time
   - Detects `ralph task done` calls
   - Tracks time without output (stuck detection)
   - Enforces timeout limits

4. **Completion**
   
   When the agent finishes:
   ```bash
   # Agent calls this when done
   ralph task done 3
   ralph progress add "Created user schema with email, password, and timestamps"
   
   # Ralph automatically commits
   git add .
   git commit -m "feat: create user authentication schema"
   ```

### Iteration Outcomes

Each iteration ends in one of these states:

#### Success

The agent completed the task successfully:
- Called `ralph task done`
- Made code changes
- Ralph committed the changes
- Moved to next task

#### Timeout

The agent exceeded the configured timeout:
- Default: 30 minutes (`agentTimeoutMs: 1800000`)
- Ralph stops the agent
- Retries with timeout context

#### Stuck

The agent produced no output for too long:
- Default: 5 minutes (`stuckThresholdMs: 300000`)
- Indicates the agent is waiting or frozen
- Ralph stops and retries

#### Error

The agent exited with an error:
- Process crashed
- Unhandled exception
- Ralph captures error details
- Retries with error context

#### Decomposed

The task was too complex:
- Agent outputs `DECOMPOSE_TASK` marker
- Provides subtask list
- Ralph replaces original task with subtasks
- Continues with first subtask

### Retry Logic

When an iteration fails, Ralph automatically retries with additional context:

```
Iteration 1: Timeout
    ↓
Retry 1: Include timeout context
    ↓
Retry 2: Include previous failure context
    ↓
Retry 3: Final attempt with all context
    ↓
If still fails: Skip task, log error
```

Configure retry behavior:

```json
{
  "maxRetries": 3,
  "retryDelayMs": 5000
}
```

### Configuring Iterations

Control iteration behavior in `~/.ralph/config.json`:

```json
{
  "agentTimeoutMs": 1800000,
  "stuckThresholdMs": 300000,
  "maxRetries": 3,
  "retryDelayMs": 5000
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `agentTimeoutMs` | 1800000 (30 min) | Max time per iteration |
| `stuckThresholdMs` | 300000 (5 min) | No-output threshold |
| `maxRetries` | 3 | Retry attempts per task |
| `retryDelayMs` | 5000 (5 sec) | Delay between retries |

### Iteration Examples

#### Successful Iteration

```
Iteration 3/10
Task: [3] Create user authentication schema

[00:00] Starting agent...
[00:05] Reading existing schema files...
[00:15] Creating user model with Prisma...
[00:45] Adding email and password fields...
[01:20] Creating migration file...
[01:50] Running migration...
[02:10] ✓ ralph task done 3
[02:15] ✓ ralph progress add "Created user schema"
[02:20] ✓ Committed changes

✓ Iteration complete (2m 20s)
```

#### Failed Iteration with Retry

```
Iteration 4/10
Task: [4] Implement user signup endpoint

[00:00] Starting agent...
[00:10] Creating signup route...
[05:00] ⚠ No output for 5 minutes (stuck threshold)
[05:00] ✗ Iteration failed: Agent stuck

Retry 1/3 (after 5s delay)
[05:05] Starting agent with stuck context...
[05:15] Creating signup route...
[05:45] Adding validation...
[06:30] Implementing password hashing...
[07:10] ✓ ralph task done 4
[07:15] ✓ Committed changes

✓ Retry successful (2m 10s)
```

## Background Mode

For long-running sessions, run Ralph in the background:

```bash
ralph run -b
```

Ralph detaches from the terminal:

```
✓ Ralph started in background (PID: 12345)
→ Check status with: ralph status
→ View logs: tail -f ~/.ralph/projects/my-project/logs/latest.log
```

Monitor progress:

```bash
ralph status        # Check session state
ralph progress      # View progress notes
ralph task list     # View task completion
```

Stop background session:

```bash
ralph stop
```

## Session Persistence

Ralph saves session state after every iteration, allowing you to:

- Resume after crashes or restarts
- Stop and continue later
- Track progress across days
- Analyze session history

Session data is stored in:

```
~/.ralph/projects/<project>/
├── session.json           # Current session state
├── logs/                  # Iteration logs
│   ├── latest.log
│   ├── 2024-01-20.log
│   └── ...
└── session-memory.json    # Cross-session learning
```

## Multiple Sessions

You can run sessions on different projects simultaneously:

```bash
cd project-a
ralph run -b

cd ../project-b
ralph run -b

# Both sessions run independently
ralph projects       # List all active projects
```

Each project maintains its own:
- PRD and tasks
- Session state
- Configuration
- Progress notes
- Logs

## Next Steps

- [Verification & Retries](/docs/core-concepts/verification-and-retries/) — How Ralph handles failures intelligently
- [Configuration](/docs/configuration/overview/) — Customize timeouts, retries, and behavior
- [Troubleshooting](/docs/troubleshooting/common-issues/) — Solutions to common session issues
