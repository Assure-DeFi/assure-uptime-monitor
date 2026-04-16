---
name: ralph
description: Initialize or continue a Ralph Loop execution for phase-driven development. Use for implementing features from PRDs with iterative commits.
---

# Ralph Loop Execution

You are now operating in Ralph Loop mode - an iterative, phase-driven development approach.

## Context Loading

First, load the execution context:

1. Read the ralph-loop state file if it exists:
   - Check `.claude/ralph-loop.local.md` for active loop state
   - Note the current iteration, max iterations, and completion promise

2. If `$ARGUMENTS` is provided, use it as the task description. Otherwise, use the state file.

3. Locate and read:
   - PRD file (usually in `/tasks/` or specified in state)
   - Task tracking file (usually `tasks-*.md`)
   - Current CLAUDE.md for project conventions

## Operating Mode

**Be aggressive**: Take routine actions without asking:
- Edit files
- Run commands
- Install common dependencies
- Commit changes
- Push to GitHub

**Prefer small, reversible changes** - one commit per feature or phase chunk.

## Parallel Execution (Required)

Before implementing, apply the parallel-task-execution rules:

1. **Load PRD tasks** - Identify all tasks from the PRD/task file
2. **Assign subagent types** - Every task gets an explicit subagent type:
   - `Explore` for research/discovery
   - `general-purpose` for implementation
   - `frontend-design` for UI work
   - `code-reviewer` for validation
   - `Bash` for commands/tests
3. **Map dependencies** - Identify hard dependencies (data flows) vs soft/none
4. **Group into waves** - Parallel tasks in same wave, sequential across waves
5. **Execute in parallel** - Use Task tool with multiple parallel calls per wave
6. **Commit after each wave** - One commit per completed wave

**Phase = Wave** in Ralph Loop context. Each wave completion triggers a commit.

### Wave Execution Pattern

```
Wave 1: [Explore: patterns, Explore: architecture] → parallel Task calls
  ↓ commit
Wave 2: [general-purpose: API, general-purpose: DB] → parallel Task calls
  ↓ commit
Wave 3: [code-reviewer: review] → single Task call
  ↓ commit + push
```

## Iteration Loop

For each iteration, execute this cycle:

### 1. Assess Current State
```bash
# Check git status
git status

# Check current branch
git branch --show-current

# Read task file to find next incomplete task
```

### 2. Plan the Smallest Next Step
- Find the first uncompleted task in the tracking file
- Break it into the smallest implementable unit
- Consider dependencies and prerequisites

### 3. Implement
- Write code following project conventions
- Use existing patterns from the codebase
- Keep changes minimal and focused

### 4. Run Checks
```bash
# TypeScript check
npx tsc --noEmit

# Lint
npm run lint || pnpm lint

# Build (if applicable)
npm run build || pnpm build

# Tests (if applicable)
npm test || pnpm test
```

### 5. Update Progress
- Mark completed tasks in the task tracking file
- Add notes about any blockers or discoveries

### 6. Commit
```bash
git add .
git commit -m "feat: <description of change>

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 7. Push
```bash
git push origin HEAD
```

## Branch Workflow

- Always work on a branch: `work/<phase>-<short-name>`
- If on main, create a new branch first:
  ```bash
  git checkout -b work/<phase>-<feature>
  ```
- Push continuously to the branch
- Never force push

## Definition of Done

### Phase Complete
When ALL of these are true:
- All phase tasks are checked off
- All checks pass (tests, lint, build)
- Changes are committed and pushed
- PR exists (unless told otherwise)

Output: `<promise>PHASE COMPLETE</promise>`

### Task Complete
When end-to-end success criteria are met:

Output: `<promise>TASK COMPLETE</promise>`

## Safety Rules

- Never commit secrets or credentials
- Ensure `.env` is in `.gitignore`
- Run secret scan before pushing if concerned
- If blocked, document the blocker and continue where possible

## MCP Usage

Follow the MCP usage policy from CLAUDE.md:
- **n8n/Synta**: Require `EXECUTE_PROD: YES` for production workflows
- **GitHub**: Create branches, push, open PRs - never change settings
- **Notion/Airtable**: Treat as production data

## Start Execution

Now begin the Ralph Loop:
1. Load context from state file or arguments
2. Identify current phase and task
3. Execute the iteration loop
4. Report progress after each iteration
