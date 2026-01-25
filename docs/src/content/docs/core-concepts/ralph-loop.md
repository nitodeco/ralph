---
title: Ralph loop
description: Understand the Ralph loop methodology and how Ralph applies it to long-running agent sessions.
sidebar:
  order: 5
  label: Ralph loop
---

# Ralph loop

The Ralph loop is a simple methodology: keep an AI coding agent running in a loop so it can make steady progress over a long sequence of tasks. Instead of one-off prompts, the loop keeps execution focused, repeatable, and aligned with a defined plan.

The concept originates from Geoffrey Huntley, who described it as a simple shell loop that repeatedly runs an agent prompt. Ralph productizes that idea into a full workflow with task tracking, verification, and session memory. Read the original article: [Ralph Wiggum as a "software engineer"](https://ghuntley.com/ralph/).

## The loop in practice

At its core, the loop is about running the agent repeatedly:

```bash
while :; do cat PROMPT.md | claude-code ; done
```

Ralph turns that pattern into a structured workflow by binding each iteration to a specific task and adding safety rails.

## How Ralph applies the loop

Ralph implements the loop with the following structure:

- A PRD defines the ordered list of tasks
- Each iteration runs the agent against the next pending task
- Progress and completion are tracked after every iteration
- Verification and retries handle failures without losing context
- Session state persists so work can resume later

## Why it matters

Running an agent in a loop provides momentum. Ralph adds the structure needed to keep that momentum aligned with real deliverables, even across long-running sessions.

## Next steps

- [PRDs](/docs/core-concepts/prds/) — Define the work to be done
- [Tasks](/docs/core-concepts/tasks/) — Break work into atomic steps
- [Sessions & Iterations](/docs/core-concepts/sessions-and-iterations/) — Understand the loop lifecycle
- [Verification & Retries](/docs/core-concepts/verification-and-retries/) — Keep progress reliable
