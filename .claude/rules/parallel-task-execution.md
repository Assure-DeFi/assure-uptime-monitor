# Parallel Task Execution Rules

These rules apply when creating or executing task lists.

## Core Principle

When creating task lists, ALWAYS optimize for parallel subagent execution. Sequential execution is a last resort.

## Mandatory Workflow

When creating or receiving a task list:

### 1. Assign Subagent Types

Every task MUST have an assigned subagent type:

| Subagent Type | Use When |
|---------------|----------|
| `Explore` | Finding patterns, understanding architecture, searching codebase |
| `Plan` | Designing solutions, planning implementation approaches |
| `Bash` | Running commands, tests, builds, git operations |
| `code-reviewer` | Reviewing changes, checking standards compliance |
| `frontend-design` | UI/UX work, component styling, visual design |
| `general-purpose` | Implementation, mixed tasks, complex multi-step work |

### 2. Map Dependencies

Classify dependencies between tasks:

- **Hard:** Task B CANNOT start until Task A completes (data dependency)
- **Soft:** Task B benefits from A but can start independently (nice-to-have order)
- **None:** Tasks are fully independent (parallelize!)

**Default assumption:** Tasks are independent unless there's a clear data dependency.

### 3. Group Into Waves

Group independent tasks into parallel execution waves:

```
Wave 1: [Task 1, Task 2, Task 3] (no dependencies - run parallel)
Wave 2: [Task 4, Task 5] (blocked by Wave 1 - run parallel)
Wave 3: [Task 6] (blocked by Wave 2)
```

### 4. Present Optimized Plan

Always output task plans in this format:

```markdown
## Execution Plan

### Wave 1: Foundation (Parallel: 3 tasks)
| Task | Subagent | Description |
|------|----------|-------------|
| 1 | Explore | Find existing auth patterns |
| 2 | Explore | Understand API structure |
| 3 | Bash | Check current test coverage |

### Wave 2: Implementation (Parallel: 2 tasks)
Blocked by: Wave 1
| Task | Subagent | Description |
|------|----------|-------------|
| 4 | general-purpose | Implement user service |
| 5 | frontend-design | Create login component |

### Wave 3: Validation (Sequential: 1 task)
Blocked by: Wave 2
| Task | Subagent | Description |
|------|----------|-------------|
| 6 | code-reviewer | Review all changes |

**Summary:**
- Total Tasks: 6
- Parallel Waves: 3
- Max Parallelism: 3 tasks (Wave 1)
- Sequential steps avoided: 4
```

## Anti-Patterns (Never Do)

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Linear chain (1 → 2 → 3 → 4) | Group independent tasks into waves |
| Missing subagent types | Always assign explicit subagent type |
| All tasks in one wave | Split into logical phases if there are dependencies |
| Over-serialization | Only block on hard dependencies |

## Example: Converting Linear to Parallel

**Before (Bad):**
```
1. Read codebase → 2. Plan API → 3. Implement endpoint → 4. Write tests → 5. Update docs
```

**After (Good):**
```
Wave 1 (parallel):
- [Explore] Read codebase
- [Explore] Check existing test patterns
- [Explore] Review API conventions

Wave 2 (parallel):
- [general-purpose] Implement endpoint
- [general-purpose] Write tests
- [general-purpose] Update docs

Wave 3:
- [code-reviewer] Review all changes
```

## Enforcement

When you see a task list:
1. Count tasks that could run in parallel
2. If parallelism < 50% of total tasks, restructure
3. Always present the wave-based execution plan
4. Use Task tool with appropriate subagent_type for each task
