---
title: Common Issues
description: Solutions to common problems when using Ralph including agent issues, session management, task failures, GitHub integration errors, configuration problems, and memory troubleshooting.
sidebar:
  order: 1
  label: Common Issues
---

# Common Issues

This page covers frequently encountered issues and their solutions. For each problem, we provide symptoms, causes, and step-by-step solutions.

## Agent Issues

### Agent Not Found

**Symptoms:**
```
Error: cursor: command not found
Error: spawn cursor ENOENT
```

**Cause:** The AI agent CLI is not installed or not in your PATH.

**Solutions:**

1. **Verify agent installation:**

```bash
# For Cursor CLI
which cursor

# For Claude Code
which claude

# For Codex
which codex
```

If the command returns nothing, the agent isn't in your PATH.

2. **Install the agent:**

- [Cursor CLI installation guide](https://docs.cursor.com/cli)
- [Claude Code installation guide](https://docs.anthropic.com/en/docs/claude-code)
- [Codex CLI installation guide](https://github.com/openai/codex)

3. **Add agent to PATH:**

If installed but not in PATH, add the installation directory:

```bash
# For bash
echo 'export PATH="/path/to/agent:$PATH"' >> ~/.bashrc
source ~/.bashrc

# For zsh
echo 'export PATH="/path/to/agent:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

4. **Verify Ralph can find the agent:**

```bash
ralph config
```

Check that the `agent` setting matches your installed agent.

### Agent Keeps Timing Out

**Symptoms:**
- Iterations consistently hit the 30-minute timeout
- Ralph retries but times out again
- Tasks are never completed

**Causes:**
- Tasks are too complex for the timeout window
- Agent is working on large files or complex operations
- System is slow or under heavy load

**Solutions:**

1. **Increase the timeout:**

Edit `~/.ralph/config.json`:

```json
{
  "agentTimeoutMs": 3600000
}
```

Common timeout values:
- 1800000 (30 min) — Default, good for most tasks
- 3600000 (1 hour) — Complex refactors
- 5400000 (90 min) — Large migrations
- 7200000 (2 hours) — Extremely complex tasks

2. **Break tasks into smaller pieces:**

```bash
# View current task
ralph task current

# If too large, break it down
ralph task remove 3
ralph task add --title "Smaller subtask 1"
ralph task add --title "Smaller subtask 2"
```

3. **Check system resources:**

```bash
# CPU usage
top

# Memory usage
free -h

# Disk I/O
iostat
```

If system is overloaded, close other applications or increase resources.

4. **Try a different agent:**

Some agents work better for certain tasks:

```json
{
  "agent": "claude"
}
```

### Agent Appears Stuck

**Symptoms:**
- Agent runs but produces no output for 5+ minutes
- Terminal shows no activity
- Ralph eventually triggers stuck detection

**Causes:**
- Agent is waiting for user input (shouldn't happen but can)
- Agent is processing large files
- Network issues (agent can't reach API)
- Agent crashed but process didn't exit

**Solutions:**

1. **Reduce stuck threshold for faster detection:**

```json
{
  "stuckThresholdMs": 180000
}
```

2. **Check agent process:**

```bash
# Find agent process
ps aux | grep cursor

# If hung, kill it
kill -9 <pid>

# Ralph will detect and retry
```

3. **Check network connectivity:**

```bash
# Test internet connection
ping -c 3 google.com

# Check if agent API is reachable
curl -I https://api.cursor.sh
```

4. **Review logs for clues:**

```bash
tail -f ~/.ralph/projects/<project>/logs/latest.log
```

Look for:
- Network errors
- API rate limits
- Authentication issues

5. **Manually complete the task:**

If stuck repeatedly on same task:

```bash
# Complete it yourself
# ... make the changes ...

# Mark as done
ralph task done 3
ralph progress add "Completed manually due to agent issues"

# Continue with next task
ralph run
```

### Agent Produces Errors

**Symptoms:**
- Agent exits with error code
- Error messages in output
- Iteration fails immediately

**Common Errors and Solutions:**

**"Permission denied"**
```bash
# Fix file permissions
chmod +x script.sh

# Fix directory permissions
chmod 755 directory/
```

**"Module not found"**
```bash
# Install dependencies
npm install
# or
bun install
```

**"Git conflict"**
```bash
# Resolve conflicts
git status
git diff
# Fix conflicts manually
git add .
git commit
```

**"Database connection failed"**
```bash
# Check database is running
docker ps

# Verify connection string
cat .env

# Test connection
psql -h localhost -U user -d database
```

## Session Issues

### Session Already Running

**Symptoms:**
```
Error: A session is already active for this project
Cannot start new session while another is running
```

**Cause:** Ralph prevents multiple concurrent sessions on the same project to avoid conflicts.

**Solutions:**

1. **Check session status:**

```bash
ralph status
```

2. **Stop the existing session:**

```bash
ralph stop
```

Wait for graceful shutdown, then start new session:

```bash
ralph run
```

3. **Force kill if unresponsive:**

```bash
# Find Ralph process
ps aux | grep ralph

# Kill it
kill -9 <pid>

# Clean up session state
ralph clear

# Start fresh
ralph run
```

### Can't Resume Session

**Symptoms:**
```
Error: No session to resume
Session file not found or corrupted
```

**Causes:**
- Session was never started
- Session was cleared
- Session file was deleted or corrupted
- Working in wrong directory

**Solutions:**

1. **Check session state:**

```bash
ralph status
```

2. **Verify you're in the right project:**

```bash
pwd
ralph projects current
```

3. **Check if session file exists:**

```bash
ls -la ~/.ralph/projects/<project>/session.json
```

4. **If corrupted, start fresh:**

```bash
ralph clear
ralph run
```

### Session Progress Lost

**Symptoms:**
- Progress notes disappeared
- Task completion status reset
- Session appears to start from beginning

**Causes:**
- Session was cleared with `ralph clear`
- Working in wrong directory
- Project not properly registered
- Session file was manually deleted

**Solutions:**

1. **Verify current project:**

```bash
ralph projects current
```

2. **Check if you're in the right directory:**

```bash
pwd
git remote -v
```

3. **List all projects:**

```bash
ralph projects
```

4. **Check session file:**

```bash
cat ~/.ralph/projects/<project>/session.json
```

5. **If data is truly lost, review logs:**

```bash
ls ~/.ralph/projects/<project>/logs/
cat ~/.ralph/projects/<project>/logs/2024-01-20.log
```

Logs contain historical progress that can help reconstruct what was done.

### Session Won't Stop

**Symptoms:**
- `ralph stop` hangs
- `Ctrl+C` doesn't work
- Session continues running

**Solutions:**

1. **Wait for current iteration to complete:**

Ralph tries to stop gracefully, which means waiting for the current iteration to finish.

2. **Force stop with multiple Ctrl+C:**

```bash
# Press Ctrl+C twice quickly
^C^C
```

3. **Kill the process:**

```bash
# Find Ralph process
ps aux | grep ralph

# Kill it
kill -9 <pid>
```

4. **Clean up afterward:**

```bash
ralph status  # Verify it stopped
ralph clear   # If needed
```

## Task Issues

### No Tasks Found

**Symptoms:**
```
Error: No tasks defined in PRD
PRD file is empty or missing
```

**Causes:**
- Project not initialized
- PRD file was deleted
- Working in wrong directory

**Solutions:**

1. **Initialize the project:**

```bash
ralph init
```

2. **Verify PRD file exists:**

```bash
ls -la ~/.ralph/projects/<project>/prd.json
cat ~/.ralph/projects/<project>/prd.json
```

3. **Manually add tasks:**

```bash
ralph task add --title "First task"
ralph task add --title "Second task"
```

### Tasks Not Completing

**Symptoms:**
- Agent appears to finish work
- But task status stays pending
- `ralph task list` shows no progress

**Causes:**
- Agent isn't calling `ralph task done`
- Ralph command not accessible from agent
- Agent doesn't have permissions to run commands

**Solutions:**

1. **Check logs for `ralph task done` calls:**

```bash
grep "ralph task done" ~/.ralph/projects/<project>/logs/latest.log
```

2. **Verify Ralph is in agent's PATH:**

```bash
# Test from agent's perspective
which ralph
```

3. **Manually mark task done:**

```bash
ralph task done 3
```

4. **Add explicit instruction:**

Create or edit `~/.ralph/projects/<project>/instructions.md`:

```markdown
## Completion Protocol

When you finish a task, you MUST run:
```bash
ralph task done <task-number>
ralph progress add "Description of what was done"
```
```

### Wrong Task Being Worked On

**Symptoms:**
- Agent working on task 5 when task 3 is pending
- Tasks completed out of order
- Unexpected task in `ralph task current`

**Causes:**
- Tasks were manually marked done incorrectly
- Task status got out of sync
- Multiple sessions running (shouldn't happen)

**Solutions:**

1. **Check current task:**

```bash
ralph task current
```

2. **View all task statuses:**

```bash
ralph task list
```

3. **Fix incorrect completions:**

```bash
# Mark incorrectly completed tasks as undone
ralph task undone 5
ralph task undone 4

# Verify order
ralph task list
```

4. **Manually set correct task:**

```bash
# Complete tasks up to where you want to be
ralph task done 1
ralph task done 2
# Now task 3 will be current
```

### Task Keeps Failing

**Symptoms:**
- Same task fails repeatedly
- All retries exhausted
- Ralph moves to next task

**Causes:**
- Task is too complex
- Task description is unclear
- Agent lacks necessary context
- Technical blocker (missing dependency, etc.)

**Solutions:**

1. **Review failure logs:**

```bash
ralph analyze patterns
```

2. **Break task into smaller subtasks:**

```bash
ralph task remove 3
ralph task add --title "Subtask 1: Setup"
ralph task add --title "Subtask 2: Implementation"
ralph task add --title "Subtask 3: Testing"
```

3. **Add more context via guardrails:**

```bash
ralph guardrails add "For task 3, use the pattern from src/existing-example.ts"
```

4. **Complete manually and document:**

```bash
# Do the work yourself
# ... make changes ...

# Mark done with explanation
ralph task done 3
ralph progress add "Completed manually. Agent struggled with X, used Y approach instead."
```

## GitHub Issues

### Not Authenticated

**Symptoms:**
```
Error: Not authenticated with GitHub
GitHub operations require authentication
```

**Cause:** GitHub credentials not configured or expired.

**Solutions:**

1. **Check auth status:**

```bash
ralph auth
```

2. **Login:**

```bash
ralph auth login
```

Follow the OAuth device flow instructions.

3. **If using personal access token:**

```bash
ralph github set-token ghp_xxxxxxxxxxxxx
```

4. **Verify authentication:**

```bash
ralph auth
```

Should show "Authenticated" status.

### Repository Not Found

**Symptoms:**
```
Error: Repository not found
Could not detect GitHub repository
```

**Causes:**
- No git remote configured
- Remote doesn't point to GitHub
- Wrong directory

**Solutions:**

1. **Check git remotes:**

```bash
git remote -v
```

Should show a GitHub URL:
```
origin  git@github.com:user/repo.git (fetch)
origin  git@github.com:user/repo.git (push)
```

2. **Add GitHub remote if missing:**

```bash
git remote add origin git@github.com:user/repo.git
```

3. **Verify you're in the right directory:**

```bash
pwd
ls -la .git
```

4. **Check Ralph can detect it:**

```bash
ralph github
```

### PR Creation Fails

**Symptoms:**
```
Error: Failed to create pull request
API error: 422 Unprocessable Entity
```

**Causes:**
- Branch already exists
- No changes to commit
- Insufficient permissions
- Invalid PR title/body

**Solutions:**

1. **Check if branch exists:**

```bash
git branch -a | grep feature-branch
```

2. **Verify you have changes:**

```bash
git status
git diff
```

3. **Re-authenticate with full permissions:**

```bash
ralph auth logout
ralph auth login
```

Ensure you grant `repo` scope.

4. **Try creating PR manually:**

```bash
gh pr create --title "Test" --body "Test"
```

If this works, the issue is with Ralph's integration.

## Configuration Issues

### Invalid Configuration

**Symptoms:**
```
Error: Invalid configuration
Failed to parse config file
```

**Cause:** JSON syntax error in config file.

**Solutions:**

1. **Validate JSON:**

```bash
cat ~/.ralph/config.json | jq .
```

If `jq` reports an error, fix the JSON syntax.

2. **Common JSON errors:**

```json
// Bad: Trailing comma
{
  "agent": "cursor",
}

// Good: No trailing comma
{
  "agent": "cursor"
}

// Bad: Single quotes
{
  'agent': 'cursor'
}

// Good: Double quotes
{
  "agent": "cursor"
}
```

3. **Reset to defaults:**

```bash
mv ~/.ralph/config.json ~/.ralph/config.json.backup
echo '{"agent": "cursor"}' > ~/.ralph/config.json
```

4. **Verify configuration:**

```bash
ralph config
```

### Settings Not Taking Effect

**Symptoms:**
- Changed timeout but still timing out at old value
- Changed agent but still using old one
- Configuration appears ignored

**Causes:**
- Editing wrong config file (global vs project)
- JSON syntax error (silently ignored)
- Session started before config change
- Environment variable override

**Solutions:**

1. **Stop and restart session:**

```bash
ralph stop
ralph run
```

Config is loaded at session start.

2. **Verify which config is active:**

```bash
ralph config --verbose
```

Shows source of each setting.

3. **Check for syntax errors:**

```bash
cat ~/.ralph/config.json | jq .
cat ~/.ralph/projects/<project>/config.json | jq .
```

4. **Check for environment variable overrides:**

```bash
env | grep RALPH
```

Environment variables take precedence over config files.

## Memory Issues

### Memory Warning

**Symptoms:**
```
Warning: Memory usage exceeds 500 MB
Consider reducing maxOutputBufferBytes
```

**Cause:** Ralph's memory usage is high, usually from large agent output.

**Solutions:**

1. **Reduce output buffer:**

```json
{
  "memory": {
    "maxOutputBufferBytes": 2621440
  }
}
```

2. **Clear session and restart:**

```bash
ralph stop
ralph clear
ralph run
```

3. **Check for memory leaks:**

```bash
# Monitor Ralph's memory usage
ps aux | grep ralph

# If growing continuously, report as bug
```

4. **Increase system memory or close other applications**

### Out of Memory

**Symptoms:**
```
Error: JavaScript heap out of memory
FATAL ERROR: Reached heap limit
```

**Cause:** Ralph ran out of memory, usually on very long sessions.

**Solutions:**

1. **Increase Node.js memory limit:**

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
ralph run
```

2. **Reduce memory thresholds:**

```json
{
  "memory": {
    "maxOutputBufferBytes": 1048576,
    "memoryThresholdMb": 512
  }
}
```

3. **Run shorter sessions:**

```bash
ralph run 5  # Instead of 20
```

4. **Clear and restart:**

```bash
ralph clear
ralph run
```

## Performance Issues

### Slow Iterations

**Symptoms:**
- Each iteration takes very long
- Agent appears slow to respond
- System feels sluggish

**Solutions:**

1. **Check system resources:**

```bash
top
free -h
df -h
```

2. **Close unnecessary applications**

3. **Check network speed:**

```bash
speedtest-cli
```

Agent APIs require good internet connection.

4. **Try a different agent:**

Some agents are faster than others for certain tasks.

### High CPU Usage

**Symptoms:**
- CPU at 100%
- System fans running loud
- Other applications slow

**Solutions:**

1. **Check what's using CPU:**

```bash
top
```

2. **If agent process is the culprit:**

This is normal during active development. Agent is analyzing code and generating responses.

3. **Reduce concurrent operations:**

Don't run multiple Ralph sessions simultaneously.

4. **Increase iteration timeout:**

Give agent more time to work without rushing:

```json
{
  "agentTimeoutMs": 3600000
}
```

## Getting Help

If your issue isn't listed here:

### 1. Check Logs

```bash
# Latest log
tail -f ~/.ralph/projects/<project>/logs/latest.log

# All logs
ls ~/.ralph/projects/<project>/logs/

# Search for errors
grep -i error ~/.ralph/projects/<project>/logs/*.log
```

### 2. Search GitHub Issues

[Ralph GitHub Issues](https://github.com/nitodeco/ralph/issues)

Search for your error message or symptoms.

### 3. Open a New Issue

Include:

- **Ralph version:** `ralph --version`
- **Agent being used:** From `ralph config`
- **Operating system:** `uname -a`
- **Error message:** Full error text
- **Steps to reproduce:** What you did before the error
- **Logs:** Relevant log excerpts

### 4. Community Support

- GitHub Discussions
- Discord (if available)
- Stack Overflow with `ralph-cli` tag

## Next Steps

- [Where to Find Logs](/docs/troubleshooting/logs/) — Understanding Ralph's logging system
- [FAQ](/docs/faq/) — Frequently asked questions
- [Configuration](/docs/configuration/overview/) — Tune Ralph for your needs
