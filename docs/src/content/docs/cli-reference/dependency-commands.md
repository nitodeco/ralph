---
title: Dependency Commands
description: Reference for Ralph task dependency management commands. View dependency graphs, validate relationships, show blocked tasks, and control task execution order with set, add, and remove.
sidebar:
  order: 7
  label: dependency
---

# Dependency Commands

Dependency commands manage relationships between tasks. Use these to control the order in which tasks are executed and to prevent tasks from starting before their prerequisites are complete.

## ralph dependency

Show the dependency graph for all tasks.

```bash
ralph dependency
```

Alias: `ralph dependency graph`

**Output:**

```
Task Dependencies:

[1] Set up project scaffolding
    └── (no dependencies)

[2] Add database schema
    └── depends on: [1]

[3] Implement user API endpoints
    └── depends on: [1], [2]
```

## ralph dependency graph

Display a visual representation of task dependencies.

```bash
ralph dependency graph
```

Shows all tasks and their dependency relationships.

## ralph dependency validate

Check for dependency issues.

```bash
ralph dependency validate
```

Validates:

- No circular dependencies
- All referenced tasks exist
- Dependencies are consistent

**Output:**

```
Dependency validation passed.
```

Or if issues are found:

```
Dependency validation failed:
- Circular dependency detected: [2] -> [3] -> [2]
- Task [5] depends on non-existent task [99]
```

## ralph dependency ready

List tasks that are ready to be worked on.

```bash
ralph dependency ready
```

Shows tasks that have no unfinished dependencies.

**Output:**

```
Ready tasks:

[1] Set up project scaffolding
[4] Write documentation
```

## ralph dependency blocked

List tasks that are blocked by incomplete dependencies.

```bash
ralph dependency blocked
```

Shows tasks waiting on other tasks to complete.

**Output:**

```
Blocked tasks:

[2] Add database schema
    └── waiting on: [1]

[3] Implement user API endpoints
    └── waiting on: [1], [2]
```

## ralph dependency order

Show the execution order based on dependencies.

```bash
ralph dependency order
```

Displays the order in which tasks should be completed.

**Output:**

```
Execution order:

1. [1] Set up project scaffolding
2. [4] Write documentation
3. [2] Add database schema
4. [3] Implement user API endpoints
```

## ralph dependency show

Show dependencies for a specific task.

```bash
ralph dependency show 3
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | Task number |

**Output:**

```
Task [3] Implement user API endpoints

Dependencies:
  - [1] Set up project scaffolding (done)
  - [2] Add database schema (pending)

Blocked by: [2]
```

## ralph dependency set

Set all dependencies for a task.

```bash
ralph dependency set 3 1 2
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | Task number to modify |
| `[deps...]` | Task numbers that this task depends on |

This replaces any existing dependencies.

**Examples:**

```bash
ralph dependency set 3 1 2

ralph dependency set 5
```

## ralph dependency add

Add a dependency to a task.

```bash
ralph dependency add 3 2
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | Task number to modify |
| `<dep>` | Task number to add as dependency |

Adds to existing dependencies without removing them.

## ralph dependency remove

Remove a dependency from a task.

```bash
ralph dependency remove 3 1
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | Task number to modify |
| `<dep>` | Task number to remove as dependency |

## How Dependencies Work

### During Sessions

When Ralph runs, it respects task dependencies:

1. Only tasks with all dependencies completed are eligible
2. `ralph task current` returns the first eligible task
3. Blocked tasks are skipped until dependencies complete

### Best Practices

**Keep dependencies minimal:**

Only add dependencies where truly necessary. Over-constraining can slow down execution.

**Use for true prerequisites:**

```bash
ralph dependency add 3 2
```

**Don't use for preferences:**

If task order is just a preference, let Ralph handle it naturally.

## Next Steps

- [Task Commands](/docs/cli-reference/task-commands/) — Managing tasks
- [Core Concepts: Tasks](/docs/core-concepts/tasks/) — Understanding tasks
