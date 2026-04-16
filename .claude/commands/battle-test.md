---
name: battle-test
version: 1.0.0
description: Template-based E2E testing with central index and parallel agent execution
---

# Battle Test Coordinator

You are the **Battle Test Coordinator** for Mason. Your job is to orchestrate comprehensive E2E testing using template agents with a central index.

## Architecture Overview

```
COORDINATOR (you)
      │
      ▼
  index.json ← CENTRAL STATE (single source of truth)
      │
      ├── Wave 1: 3 Parallel Test Agents (UI, API, Flow)
      ├── Wave 2: 1 Diagnosis Agent (if issues found)
      └── Wave 3: 1 Fix Agent (sequential fixes)
```

## Arguments

Parse any arguments from `$ARGUMENTS`:

- `--fix-mode report-only` - Detection only, no fixes
- `--focus <area>` - Focus on: `ui`, `api`, `flow`, or `all` (default)
- `--max-parallel <n>` - Limit parallel agents (default: 3)
- `--wave <n>` - Run only up to wave N (1, 2, or 3)

## Step 1: Initialize Index

Create `.claude/battle-test/index.json` with this structure:

```json
{
  "run_id": "bt-YYYYMMDD-HHMMSS",
  "status": "initializing",
  "wave": 0,
  "iteration": 1,
  "max_iterations": 3,
  "started_at": "<ISO timestamp>",
  "config": {
    "fix_mode": "auto-fix",
    "focus": "all",
    "max_parallel": 3
  },
  "test_assignments": {
    "ui_tester": {
      "id": "UI-1",
      "pages": [
        "/",
        "/setup",
        "/auth/signin",
        "/admin/backlog",
        "/admin/analytics",
        "/settings/github",
        "/settings/api-keys",
        "/settings/database",
        "/docs/api",
        "/docs/commands",
        "/docs/concepts",
        "/docs/quickstart",
        "/faq",
        "/security"
      ],
      "status": "pending"
    },
    "api_tester": {
      "id": "API-1",
      "endpoints": "all",
      "status": "pending"
    },
    "flow_tester": {
      "id": "FLOW-1",
      "flows": ["auth_flow", "setup_flow", "backlog_crud", "execution_flow"],
      "status": "pending"
    }
  },
  "test_results": {},
  "issues": [],
  "diagnosis": {
    "completed": false,
    "root_causes": [],
    "fix_queue": []
  },
  "fix_results": []
}
```

## Step 2: Ensure Dev Server Running

Before testing, verify the development server is running:

```bash
# Check if dev server is running on port 3000
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "NOT_RUNNING"
```

If NOT running, start it in the background:

```bash
cd packages/mason-dashboard && pnpm dev &
sleep 5
```

## Step 3: Wave 1 - Parallel Testing

Update `index.json`: set `status: "testing"`, `wave: 1`

Launch **3 test agents in parallel** using a SINGLE message with 3 Task tool calls:

### UI/Visual Tester (webapp-testing)

```
Prompt: Read .claude/agents/battle-test/ui-tester.md for your instructions.

Your assignment:
- Agent ID: UI-1
- Pages to test: [full list from index]
- Output file: .claude/battle-test/results/UI-1.json

Test categories:
1. Page renders without crash
2. Auth state matrix (4 states per page)
3. Loading state completeness
4. Console error detection
5. Responsive check (desktop, tablet, mobile)
```

### API/Data Tester (webapp-testing)

```
Prompt: Read .claude/agents/battle-test/api-tester.md for your instructions.

Your assignment:
- Agent ID: API-1
- Endpoints: All /api/* routes
- Output file: .claude/battle-test/results/API-1.json

Test categories:
1. GET endpoints return correct data
2. POST/PATCH/DELETE with auth
3. CRUD round-trip verification (DB persistence)
4. Error responses (401, 404, 500)
```

### Flow/Integration Tester (webapp-testing)

```
Prompt: Read .claude/agents/battle-test/flow-tester.md for your instructions.

Your assignment:
- Agent ID: FLOW-1
- Flows: auth_flow, setup_flow, backlog_crud, execution_flow
- Output file: .claude/battle-test/results/FLOW-1.json

Test categories:
1. User journeys end-to-end
2. Realtime subscription updates
3. Session persistence
4. Error recovery
5. Edge cases and resilience
```

## Step 4: Aggregate Results

After all 3 agents complete:

1. Read each result file: `results/UI-1.json`, `results/API-1.json`, `results/FLOW-1.json`
2. Update `index.json`:
   - Populate `test_results` with each agent's summary
   - Move all issues to the `issues` array with unique IDs
   - Update each assignment's `status` to "complete"

Count total issues. If zero issues, skip to Step 7.

## Step 5: Wave 2 - Diagnosis (If Issues Found)

Update `index.json`: set `status: "diagnosing"`, `wave: 2`

Launch **1 Diagnosis Agent** (Explore type):

```
Prompt: Read .claude/agents/battle-test/diagnosis-agent.md for your instructions.

Your task:
- Read .claude/battle-test/index.json
- Analyze all issues in the issues array
- Identify ROOT CAUSES (not just symptoms)
- Group related failures (1 fix may resolve multiple failures)
- Create prioritized fix queue with exact file:line targets
- Write diagnosis results back to index.json
```

After diagnosis completes, read updated `index.json` to get the `fix_queue`.

## Step 6: Wave 3 - Sequential Fixes

If `config.fix_mode` is "report-only", skip to Step 7.

Update `index.json`: set `status: "fixing"`, `wave: 3`

For EACH item in `diagnosis.fix_queue` (sequentially, one at a time):

Launch **1 Fix Agent** (general-purpose type):

```
Prompt: Read .claude/agents/battle-test/fix-agent.md for your instructions.

Your task:
- Fix ID: <current fix id>
- Read .claude/battle-test/index.json for fix details
- Implement minimal fix
- Validate: pnpm typecheck && pnpm lint
- Re-run affected tests to verify
- Update index.json with fix result
```

Wait for each fix to complete before starting the next (prevents merge conflicts).

After all fixes complete:

- Re-run Wave 1 tests on affected areas
- If new issues found and `iteration < max_iterations`, increment iteration and loop back to Wave 2

## Step 7: Generate Report

Update `index.json`: set `status: "complete"`

Create `.claude/battle-test/report.md` with:

```markdown
# Battle Test Report - [PASSED/FAILED]

## Summary

- **Run ID**: <run_id>
- **Status**: [PASSED - Ready to Ship / FAILED - Issues Remain]
- **Duration**: <calculated>
- **Iterations**: <iteration count>

## The 10 Critical Categories

| #   | Category               | Status    | Issues |
| --- | ---------------------- | --------- | ------ |
| 1   | Auth State Matrix      | PASS/FAIL | count  |
| 2   | Data Round-Trip        | PASS/FAIL | count  |
| 3   | Realtime Subscriptions | PASS/FAIL | count  |
| 4   | Error Recovery         | PASS/FAIL | count  |
| 5   | Idempotency            | PASS/FAIL | count  |
| 6   | Loading States         | PASS/FAIL | count  |
| 7   | Boundary Conditions    | PASS/FAIL | count  |
| 8   | Session Persistence    | PASS/FAIL | count  |
| 9   | Timeout Detection      | PASS/FAIL | count  |
| 10  | Visual Regression      | PASS/FAIL | count  |

## Coverage Summary

| Area          | Tested | Passed | Fixed |
| ------------- | ------ | ------ | ----- |
| Pages         | X/Y    | X/Y    | N     |
| API Endpoints | X/Y    | X/Y    | N     |
| User Flows    | X/Y    | X/Y    | N     |

## Issues Found & Fixed

[Table of all issues with severity, description, fix, verification status]

## Remaining Issues (if any)

[List any unfixed issues that need manual attention]

## Certification

[APPROVED FOR PRODUCTION / REQUIRES MANUAL REVIEW]
```

## Progress Display

Throughout execution, output progress updates:

```
╔════════════════════════════════════════════════════════════════╗
║              BATTLE TEST - WAVE 1: PARALLEL TESTING             ║
╠════════════════════════════════════════════════════════════════╣
║  Agents: 3/3 running                     Elapsed: 2m 15s       ║
╠════════════════════════════════════════════════════════════════╣
║  UI Tester      ████████████░░░░  75%    Issues: 1             ║
║  API Tester     ████████████████ 100% ✓  Issues: 0             ║
║  Flow Tester    ██████░░░░░░░░░░  40%    Issues: 0             ║
╚════════════════════════════════════════════════════════════════╝
```

## Critical Rules

1. **Central Index**: `index.json` is the single source of truth. Always read before acting, always update after changes.

2. **Parallel Wave 1**: Launch ALL 3 test agents in a SINGLE message with 3 Task tool calls.

3. **Sequential Wave 3**: Fix agents run ONE AT A TIME to prevent merge conflicts.

4. **Minimal Context**: Each agent receives ONLY what it needs. Don't pass full index to test agents.

5. **Validate Every Fix**: Each fix must pass typecheck + lint + re-test before moving to next.

6. **Max 3 Iterations**: If issues persist after 3 fix cycles, report them as "requires manual review".

## Error Handling

- If a test agent fails/crashes: Mark its assignment as "failed" in index, continue with others
- If diagnosis finds no root causes: Report issues as "unable to diagnose automatically"
- If fix validation fails: Revert fix, try alternative approach, or escalate to manual

## Start Execution

Begin by:

1. Parsing arguments from `$ARGUMENTS`
2. Creating the initial `index.json`
3. Checking dev server status
4. Launching Wave 1 agents in parallel
