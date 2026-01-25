---
title: FAQ
description: Frequently asked questions about Ralph covering installation, usage, configuration, GitHub integration, troubleshooting, and contributing. Get quick answers to common questions.
sidebar:
  order: 1
  label: FAQ
faq:
  - question: What is Ralph?
    answer: Ralph is a CLI tool for long-running PRD-driven development with AI coding agents. It orchestrates agents like Cursor CLI to work through tasks defined in a Product Requirements Document (PRD), with automatic retries, progress tracking, and GitHub integration.
  - question: Which AI agents does Ralph support?
    answer: Ralph supports Cursor CLI (the most commonly used option), Claude Code (Anthropic's Claude Code CLI), and Codex (OpenAI's Codex CLI).
  - question: Is Ralph free?
    answer: Yes, Ralph itself is free and open source under the MIT license. However, you need a subscription to the AI agent you choose to use (e.g., Cursor Pro).
  - question: How do I install Ralph?
    answer: "The easiest way is the install script: curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash"
  - question: What are the system requirements?
    answer: macOS, Linux, or Windows (via WSL), one of the supported AI agents installed, and Git for version control and GitHub features.
  - question: How do I start a new project with Ralph?
    answer: Run 'ralph init' in your terminal. This interactively creates a PRD with tasks based on your description.
  - question: How do I run Ralph?
    answer: Run 'ralph run' to start a session with 10 iterations. You can specify more iterations with 'ralph run 20'.
  - question: Do I need GitHub to use Ralph?
    answer: No, GitHub integration is optional. Ralph works fine for local development without it.
  - question: Can I run multiple projects simultaneously?
    answer: Yes, Ralph supports multiple projects. Each project has its own PRD, configuration, and session state.
  - question: What happens if Ralph crashes?
    answer: Ralph saves session state after every iteration. You can resume exactly where you left off with 'ralph resume'.
---

# Frequently Asked Questions

## General Questions

### What is Ralph?

Ralph is a CLI tool that orchestrates AI coding agents to work through Product Requirements Documents (PRDs) autonomously. It manages long-running development sessions with automatic retries, progress tracking, and GitHub integration.

Think of Ralph as a supervisor for your AI coding agent. Instead of manually prompting the agent repeatedly, Ralph automates the entire workflow: feeding tasks, monitoring progress, handling failures, and tracking what's been completed.

### Which AI agents does Ralph support?

Ralph supports three AI coding agents:

- **Cursor CLI** — The most commonly used option, requires Cursor Pro subscription
- **Claude Code** — Anthropic's Claude Code CLI
- **Codex** — OpenAI's Codex CLI

You can switch between agents per-project or globally via configuration.

### Is Ralph free?

Yes, Ralph itself is free and open source under the MIT license. You can:

- Use it for personal or commercial projects
- Modify the source code
- Contribute improvements

However, you need a subscription to the AI agent you choose:

- Cursor Pro for Cursor CLI
- Claude API access for Claude Code
- OpenAI API access for Codex

### Does Ralph work offline?

No, Ralph requires internet access because:

- AI agents connect to their respective APIs (Anthropic, OpenAI, etc.)
- GitHub integration requires network access
- Package managers need to download dependencies

However, Ralph itself doesn't require internet beyond what the AI agent needs.

### What programming languages does Ralph support?

Ralph is language-agnostic. It works with any programming language or framework because it orchestrates the AI agent, which handles the actual coding.

Successfully used with:

- JavaScript/TypeScript (Node.js, React, Next.js)
- Python (Django, Flask, FastAPI)
- Go
- Rust
- Ruby (Rails)
- PHP (Laravel)
- Java/Kotlin
- And more

### How is Ralph different from using an AI agent directly?

| Using Agent Directly | Using Ralph |
|---------------------|-------------|
| Manual prompting for each task | Automatic task orchestration |
| No progress tracking | Persistent progress across sessions |
| Manual retry on failures | Automatic retries with context |
| Lose context between sessions | Session memory and learning |
| Manual GitHub operations | Automated PR creation |
| No structured workflow | PRD-driven systematic approach |

Ralph adds structure, automation, and reliability to AI-assisted development.

## Installation & Setup

### How do I install Ralph?

The easiest way is the automated install script:

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

This automatically:
- Detects your OS and architecture
- Downloads the appropriate binary
- Installs to `~/.local/bin`
- Adds to your PATH if needed

See [Installation Guide](/docs/getting-started/installation/) for manual installation and troubleshooting.

### What are the system requirements?

**Required:**
- macOS, Linux, or Windows (via WSL)
- One of the supported AI agents (Cursor CLI, Claude Code, or Codex)
- Git for version control

**Optional:**
- GitHub account (for PR creation and integration)
- Bun or Node.js 18+ (only if building from source)

### How do I update Ralph?

```bash
ralph update
```

This checks for the latest version and installs it automatically.

Or manually re-run the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

### Can I install Ralph without the install script?

Yes, download the binary directly from the [releases page](https://github.com/nitodeco/ralph/releases):

```bash
# macOS (Apple Silicon)
curl -L https://github.com/nitodeco/ralph/releases/latest/download/ralph-macos-arm64 -o ralph

# macOS (Intel)
curl -L https://github.com/nitodeco/ralph/releases/latest/download/ralph-macos-x64 -o ralph

# Linux
curl -L https://github.com/nitodeco/ralph/releases/latest/download/ralph-linux-x64 -o ralph

chmod +x ralph
mv ralph ~/.local/bin/
```

### Where does Ralph store data?

Ralph stores all data in `~/.ralph/`:

```
~/.ralph/
├── config.json              # Global configuration
├── registry.json            # Project registry
├── usage-statistics.json    # Usage stats
└── projects/                # Per-project data
    └── <project-name>/
        ├── config.json      # Project config
        ├── prd.json         # PRD file
        ├── session.json     # Session state
        ├── guardrails.json  # Guardrails
        ├── instructions.md  # Custom instructions
        └── logs/            # Iteration logs
```

### How do I uninstall Ralph?

Remove the binary:

```bash
rm ~/.local/bin/ralph
```

Optionally remove all data:

```bash
rm -rf ~/.ralph
```

## Usage & Workflow

### How do I start a new project?

Navigate to your project directory and run:

```bash
ralph init
```

Ralph will:
1. Ask you to describe what you want to build
2. Generate a PRD with 5-15 tasks
3. Let you choose your AI agent (Cursor, Claude, or Codex)
4. Save everything to `~/.ralph/projects/<project>/`

### How do I run Ralph?

Start a session with:

```bash
ralph run
```

This runs 10 iterations by default. For more iterations:

```bash
ralph run 20    # Run 20 iterations
ralph run 50    # Run 50 iterations
```

For long-running sessions, use background mode:

```bash
ralph run -b    # Run in background
```

### How do I stop Ralph?

If running in foreground:

```bash
# Press Ctrl+C
^C
```

If running in background:

```bash
ralph stop
```

Ralph stops gracefully after completing the current iteration.

### How do I check progress?

Multiple commands show different aspects of progress:

```bash
ralph status        # Overall session status
ralph progress      # Progress notes
ralph task list     # Task completion
ralph task current  # Next task to work on
```

Example output:

```bash
$ ralph status
Session Status:
  State: Running
  Iteration: 5 / 10
  Started: 15 minutes ago
  
Current Task:
  [4] Implement user signup endpoint
  
Recent Progress:
  ✓ Set up Express server (3 minutes)
  ✓ Configure PostgreSQL (4 minutes)
  ✓ Create user schema (5 minutes)
```

### Can I run Ralph in the background?

Yes, use the `-b` or `--background` flag:

```bash
ralph run -b
```

Ralph detaches from the terminal and continues running. Monitor with:

```bash
ralph status        # Check status
ralph progress      # View progress
ralph task list     # See completed tasks
```

View logs:

```bash
tail -f ~/.ralph/projects/<project>/logs/latest.log
```

### Can I pause and resume a session?

Yes, Ralph maintains session state:

**Pause:**
```bash
ralph stop
# or press Ctrl+C
```

**Resume:**
```bash
ralph resume
```

Ralph picks up exactly where it left off, including:
- Current task
- Iteration count
- Progress notes
- Error history

### How long does a session take?

It depends on:

- Number of tasks in your PRD
- Complexity of each task
- Configured timeouts
- Number of iterations

Typical sessions:

- **Simple CRUD API (8 tasks):** 1-2 hours
- **Full-stack feature (15 tasks):** 3-5 hours
- **Complex refactor (20+ tasks):** 6-12 hours

You can run overnight sessions with:

```bash
ralph run 100 -b
```

### What if I need to make manual changes during a session?

You can:

1. **Stop the session:**
   ```bash
   ralph stop
   ```

2. **Make your changes manually**

3. **Mark tasks as done if needed:**
   ```bash
   ralph task done 5
   ralph progress add "Completed manually"
   ```

4. **Resume:**
   ```bash
   ralph resume
   ```

Ralph continues with the next pending task.

### Can I run multiple projects simultaneously?

Yes, Ralph supports multiple projects:

```bash
cd project-a
ralph run -b

cd ../project-b
ralph run -b
```

Each project maintains independent:
- PRD and tasks
- Session state
- Configuration
- Progress tracking

View all projects:

```bash
ralph projects
```

## Tasks & PRDs

### What is a PRD?

A Product Requirements Document (PRD) is a structured list of tasks that defines what you want to build. Ralph uses the PRD to guide the AI agent through your project systematically.

Example PRD:
```
1. Set up Express server with TypeScript
2. Configure PostgreSQL database
3. Create user authentication schema
4. Implement signup endpoint
5. Implement login endpoint
6. Add JWT token generation
7. Create authentication middleware
8. Protect API routes
```

### Can I edit the PRD manually?

Yes, but use Ralph commands when possible:

```bash
ralph task add --title "New task"
ralph task edit 5 --title "Updated title"
ralph task remove 3
ralph task done 4
ralph task undone 5
```

The PRD file is stored at `~/.ralph/projects/<project>/prd.json` if you need to edit it directly.

### How do I add more tasks?

Several ways:

**During initialization:**
```bash
ralph init  # Generates tasks based on your description
```

**Add individual tasks:**
```bash
ralph task add --title "Add rate limiting"
```

**Add with details:**
```bash
ralph task add \
  --title "Add rate limiting" \
  --description "Protect API from abuse" \
  --steps "Install express-rate-limit" \
  --steps "Configure limits"
```

### What makes a good task?

Good tasks are:

**Specific:**
```
Bad:  Add authentication
Good: Implement JWT-based authentication with signup and login endpoints
```

**Appropriately scoped:**
```
Too large: Build entire authentication system
Too small: Import bcrypt library
Just right: Implement user signup endpoint with validation and password hashing
```

**Self-contained:**
```
Bad:  Create API endpoint (will add validation later)
Good: Create API endpoint with input validation and error handling
```

**Action-oriented:**
```
Create user database schema
Implement password reset flow
Add rate limiting to API endpoints
Refactor database queries to use transactions
```

See [Core Concepts: PRDs](/docs/core-concepts/prds/) for detailed guidelines.

### Can Ralph break down large tasks automatically?

Yes, Ralph supports automatic task decomposition. If the AI agent detects a task is too complex, it can:

1. Output a `DECOMPOSE_TASK` marker
2. Provide a list of subtasks
3. Ralph replaces the original task with subtasks
4. Continues with the first subtask

Example:
```
Original:
[ ] 5. Build authentication system

Decomposed:
[ ] 5.1. Create user schema
[ ] 5.2. Implement signup endpoint
[ ] 5.3. Implement login endpoint
[ ] 5.4. Add JWT generation
[ ] 5.5. Create auth middleware
```

### How do I reorder tasks?

Tasks are processed in order. To reorder:

1. **Mark completed tasks as undone:**
   ```bash
   ralph task undone 5
   ralph task undone 6
   ```

2. **Complete tasks in desired order:**
   ```bash
   ralph task done 6
   ralph task done 5
   ```

Or edit the PRD file directly to reorder tasks.

### What if a task is no longer needed?

Remove it:

```bash
ralph task remove 5
ralph progress add "Removed task 5 - no longer needed"
```

Or mark it done to skip it:

```bash
ralph task done 5
ralph progress add "Skipped - requirement changed"
```

## Configuration & Customization

### Where is configuration stored?

Ralph uses a layered configuration system:

- **Global:** `~/.ralph/config.json` (defaults for all projects)
- **Per-project:** `~/.ralph/projects/<project>/config.json` (overrides global)

Project settings override global settings.

### How do I change the AI agent?

**Interactive setup:**
```bash
ralph setup
```

**Edit global config:**
```bash
echo '{"agent": "claude"}' > ~/.ralph/config.json
```

**Edit project config:**
```bash
echo '{"agent": "claude"}' > ~/.ralph/projects/<project>/config.json
```

Supported agents: `cursor`, `claude`, `codex`

### How do I increase timeouts?

Edit your config file:

```json
{
  "agentTimeoutMs": 3600000,
  "stuckThresholdMs": 600000
}
```

Common timeout values:
- `1800000` (30 min) — Default
- `3600000` (1 hour) — Complex tasks
- `5400000` (90 min) — Large refactors
- `7200000` (2 hours) — Migrations

See [Configuration Guide](/docs/configuration/overview/) for all options.

### Can I customize agent instructions?

Yes, create `~/.ralph/projects/<project>/instructions.md`:

```markdown
# Project Instructions

## Technology Stack
- TypeScript with strict mode
- Bun as runtime
- Prisma for database

## Code Standards
- Use functional programming
- Write descriptive variable names
- Add JSDoc for public APIs

## Project Structure
- API routes in src/routes/
- Business logic in src/services/
- Database models in src/models/
```

Ralph includes these instructions in every agent prompt.

### How do I configure notifications?

Edit your config:

```json
{
  "notifications": {
    "systemNotification": true,
    "webhookUrl": "https://hooks.slack.com/services/...",
    "markerFilePath": ".ralph/complete.marker"
  }
}
```

Options:
- **systemNotification:** OS notification on completion
- **webhookUrl:** POST to webhook (Slack, Discord, etc.)
- **markerFilePath:** Create file when done

### Can I have different settings per project?

Yes, project config overrides global config:

**Global (default for all projects):**
```bash
cat > ~/.ralph/config.json << EOF
{
  "agent": "cursor",
  "agentTimeoutMs": 1800000
}
EOF
```

**Project-specific:**
```bash
cat > ~/.ralph/projects/my-project/config.json << EOF
{
  "agent": "claude",
  "agentTimeoutMs": 3600000
}
EOF
```

This project uses Claude with 1-hour timeout, while others use global settings.

## GitHub Integration

### Do I need GitHub to use Ralph?

No, GitHub integration is completely optional. Ralph works perfectly for local development without any GitHub connection.

Use GitHub integration if you want:
- Automatic PR creation
- Branch management
- Commit pushing to remote

### How do I connect GitHub?

Authenticate with OAuth device flow:

```bash
ralph auth login
```

Follow the prompts:
1. Ralph displays a code and URL
2. Open the URL in your browser
3. Enter the code
4. Authorize the Ralph application
5. Return to terminal

Verify authentication:

```bash
ralph auth
```

See [GitHub Integration Guide](/docs/github-integration/setup/) for details.

### Can Ralph create pull requests automatically?

Yes, after authenticating:

```bash
ralph auth login
```

Ralph can create PRs from completed work. Configure PR creation in your workflow or use commands:

```bash
# After completing tasks
ralph github create-pr --title "Feature: User Authentication" --body "Implemented signup and login"
```

### What GitHub permissions does Ralph need?

Ralph requests:

- **repo** — Read/write access to repositories (create branches, push commits, create PRs)
- **read:user** — Read your user profile

These are the minimum permissions needed for full functionality.

### Can I use a personal access token instead of OAuth?

Yes, if you prefer:

1. Create a token at [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Grant `repo` scope
3. Set the token:

```bash
ralph github set-token ghp_xxxxxxxxxxxxx
```

OAuth is recommended for better security and automatic token refresh.

### How do I disconnect GitHub?

```bash
ralph auth logout
```

This clears stored credentials. You can reconnect anytime with `ralph auth login`.

## Troubleshooting & Common Issues

### Ralph keeps retrying the same task

**Causes:**
- Task is too complex
- Task description is unclear
- Agent lacks necessary context
- Technical blocker (missing dependency, etc.)

**Solutions:**

1. **Break the task down:**
   ```bash
   ralph task remove 5
   ralph task add --title "Subtask 1: Setup"
   ralph task add --title "Subtask 2: Implementation"
   ```

2. **Add more context via guardrails:**
   ```bash
   ralph guardrails add "For authentication, use the pattern from src/auth/example.ts"
   ```

3. **Check logs for specific errors:**
   ```bash
   tail -f ~/.ralph/projects/<project>/logs/latest.log
   ```

4. **Complete manually:**
   ```bash
   # Do the work yourself
   ralph task done 5
   ralph progress add "Completed manually - agent struggled with X"
   ```

### Agent times out frequently

**Causes:**
- Tasks are too complex
- Default timeout (30 min) is too short
- System is slow or under load

**Solutions:**

1. **Increase timeout:**
   ```json
   {
     "agentTimeoutMs": 3600000
   }
   ```

2. **Break tasks into smaller pieces:**
   ```bash
   ralph task edit 5 --title "Smaller, more focused task"
   ```

3. **Check system resources:**
   ```bash
   top
   free -h
   ```

### Agent appears stuck (no output)

**Causes:**
- Agent is processing large files
- Network issues
- Agent crashed but process didn't exit

**Solutions:**

1. **Reduce stuck threshold:**
   ```json
   {
     "stuckThresholdMs": 180000
   }
   ```

2. **Check agent process:**
   ```bash
   ps aux | grep cursor
   ```

3. **Kill if hung:**
   ```bash
   kill -9 <pid>
   ralph run  # Ralph will retry
   ```

### Where are the logs?

Logs are stored in:

```
~/.ralph/projects/<project>/logs/
├── latest.log           # Current session
├── 2024-01-20.log      # Daily logs
└── ...
```

View logs:

```bash
# Latest log
tail -f ~/.ralph/projects/<project>/logs/latest.log

# Search for errors
grep -i error ~/.ralph/projects/<project>/logs/*.log

# View specific date
cat ~/.ralph/projects/<project>/logs/2024-01-20.log
```

See [Troubleshooting Guide](/docs/troubleshooting/common-issues/) for more solutions.

### How do I debug issues?

1. **Check logs:**
   ```bash
   tail -f ~/.ralph/projects/<project>/logs/latest.log
   ```

2. **Check session status:**
   ```bash
   ralph status
   ```

3. **Review failure patterns:**
   ```bash
   ralph analyze patterns
   ```

4. **Check configuration:**
   ```bash
   ralph config
   ```

5. **Verify agent is accessible:**
   ```bash
   which cursor  # or claude, codex
   ```

### What if I encounter a bug?

1. **Check existing issues:**
   [Ralph GitHub Issues](https://github.com/nitodeco/ralph/issues)

2. **Open a new issue with:**
   - Ralph version: `ralph --version`
   - Agent being used: From `ralph config`
   - Operating system: `uname -a`
   - Error message: Full error text
   - Steps to reproduce
   - Relevant log excerpts

3. **Include logs:**
   ```bash
   cat ~/.ralph/projects/<project>/logs/latest.log
   ```

## Advanced Usage

### Can I use Ralph with CI/CD?

Yes, Ralph can run in CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run Ralph
  run: |
    ralph run 20 --json > results.json
    
- name: Check completion
  run: |
    DONE=$(cat results.json | jq '.done')
    TOTAL=$(cat results.json | jq '.total')
    if [ "$DONE" -ne "$TOTAL" ]; then
      exit 1
    fi
```

Configure for CI/CD:

```json
{
  "agentTimeoutMs": 600000,
  "maxRetries": 2,
  "notifications": {
    "systemNotification": false,
    "markerFilePath": "/tmp/ralph-complete"
  }
}
```

### Can I run Ralph on a remote server?

Yes, Ralph works on any Linux server:

```bash
# SSH into server
ssh user@server

# Install Ralph
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash

# Run in background
ralph run -b

# Disconnect (Ralph keeps running)
exit

# Later, check progress
ssh user@server
ralph status
```

### Can I script Ralph operations?

Yes, use `--json` flag for programmatic access:

```bash
#!/bin/bash

# Start session
ralph run 10 -b

# Wait for completion
while true; do
  STATUS=$(ralph status --json | jq -r '.state')
  if [ "$STATUS" = "complete" ]; then
    break
  fi
  sleep 60
done

# Get results
ralph task list --json > results.json
ralph progress --json > progress.json

# Send notification
curl -X POST https://hooks.slack.com/... \
  -d "{\"text\": \"Ralph session complete!\"}"
```

### How do I backup my Ralph data?

Backup the entire Ralph directory:

```bash
# Backup
tar -czf ralph-backup.tar.gz ~/.ralph

# Restore
tar -xzf ralph-backup.tar.gz -C ~/
```

Or backup specific project:

```bash
# Backup project
tar -czf project-backup.tar.gz ~/.ralph/projects/my-project

# Restore project
tar -xzf project-backup.tar.gz -C ~/.ralph/projects/
```

### Can I use Ralph with Docker?

Yes, create a Dockerfile:

```dockerfile
FROM oven/bun:latest

# Install Ralph
RUN curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash

# Install your AI agent
RUN curl -fsSL https://cursor.sh/install | bash

# Set working directory
WORKDIR /app

# Copy project
COPY . .

# Run Ralph
CMD ["ralph", "run"]
```

Build and run:

```bash
docker build -t my-ralph-project .
docker run -v ~/.ralph:/root/.ralph my-ralph-project
```

## Contributing

### How do I contribute to Ralph?

1. **Fork the repository:**
   [github.com/nitodeco/ralph](https://github.com/nitodeco/ralph)

2. **Set up development environment:**
   ```bash
   git clone https://github.com/your-username/ralph.git
   cd ralph
   bun install
   ```

3. **Make changes and test:**
   ```bash
   bun run dev
   bun test
   ```

4. **Submit a pull request**

See [Contributing Guide](/docs/contributing/local-development/) for detailed instructions.

### How do I report bugs?

Open an issue on [GitHub](https://github.com/nitodeco/ralph/issues) with:

- **Ralph version:** `ralph --version`
- **Agent being used:** From `ralph config`
- **Operating system:** `uname -a`
- **Steps to reproduce:** What you did before the error
- **Expected behavior:** What should have happened
- **Actual behavior:** What actually happened
- **Error message:** Full error text
- **Logs:** Relevant log excerpts

### Can I request features?

Yes! Open a feature request on [GitHub Issues](https://github.com/nitodeco/ralph/issues) with:

- Clear description of the feature
- Use case (why you need it)
- Proposed implementation (if you have ideas)

## Getting Help

### Where can I get help?

1. **Documentation:** [docs.ralph.dev](/docs/)
2. **FAQ:** This page
3. **GitHub Issues:** [github.com/nitodeco/ralph/issues](https://github.com/nitodeco/ralph/issues)
4. **Troubleshooting Guide:** [/docs/troubleshooting/common-issues/](/docs/troubleshooting/common-issues/)

### How do I stay updated?

- **Watch the repository:** [github.com/nitodeco/ralph](https://github.com/nitodeco/ralph)
- **Check releases:** [github.com/nitodeco/ralph/releases](https://github.com/nitodeco/ralph/releases)
- **Follow changelog:** [/changelog](/changelog)

### Is there a community?

- **GitHub Discussions:** Ask questions and share experiences
- **GitHub Issues:** Report bugs and request features
- **Discord:** (Link if available)

## More Questions?

If your question isn't answered here:

1. **Search the docs:** [/docs/](/docs/)
2. **Check troubleshooting:** [/docs/troubleshooting/common-issues/](/docs/troubleshooting/common-issues/)
3. **Search GitHub Issues:** [github.com/nitodeco/ralph/issues](https://github.com/nitodeco/ralph/issues)
4. **Ask a question:** Open a new issue or discussion
