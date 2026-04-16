---
name: pm-review
version: 3.1.0
description: Full comprehensive PM review - 25 items (24 regular + 1 banger)
---

# PM Review Command

Full comprehensive review with **8 parallel agents** returning **25 items** (3 from each category + 1 banger).

**For other modes, use the dedicated commands:**

- `/pm-banger` - 1 game-changing idea
- `/pm-quick` - 9 items (fast pulse check)
- `/pm-focus area:X` - 5 items in specific domain

---

## STEP 0: Bootstrap Sibling Commands (One-Time)

**This step ensures all PM commands exist locally.** Run once on first execution after v3.0.0 update.

```bash
BASE_URL="https://raw.githubusercontent.com/Assure-DeFi/mason/main/packages/mason-commands/commands"
COMMANDS_DIR=".claude/commands"

echo "=== BOOTSTRAP CHECK ==="

# Download missing commands
for cmd in pm-banger pm-quick pm-focus mason-update; do
  if [ ! -f "${COMMANDS_DIR}/${cmd}.md" ]; then
    echo "Downloading missing: ${cmd}.md"
    curl -fsSL "${BASE_URL}/${cmd}.md" -o "${COMMANDS_DIR}/${cmd}.md" 2>/dev/null
  fi
done

echo "All PM commands available."
echo "========================"
```

---

## Backward Compatibility Notice

```bash
# Check for old mode arguments
if echo "$*" | grep -qiE "banger|quick|area:"; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════════╗"
  echo "║           MODE ARGUMENTS REMOVED IN v3.0.0                               ║"
  echo "║                                                                          ║"
  echo "║  The /pm-review command now only runs full reviews.                      ║"
  echo "║  Use the dedicated commands for other modes:                             ║"
  echo "║                                                                          ║"
  echo "║    Instead of: /pm-review banger                                         ║"
  echo "║           Use: /pm-banger                                                ║"
  echo "║                                                                          ║"
  echo "║    Instead of: /pm-review quick                                          ║"
  echo "║           Use: /pm-quick                                                 ║"
  echo "║                                                                          ║"
  echo "║    Instead of: /pm-review area:security                                  ║"
  echo "║           Use: /pm-focus area:security                                   ║"
  echo "║                                                                          ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  exit 1
fi
```

---

## STEP 1: Version Check (BLOCKING)

```bash
COMMAND_NAME="pm-review"
LOCAL_VERSION=$(grep -m1 "^version:" ".claude/commands/${COMMAND_NAME}.md" 2>/dev/null | cut -d: -f2 | tr -d ' ')
REMOTE=$(curl -fsSL --connect-timeout 3 "https://raw.githubusercontent.com/Assure-DeFi/mason/main/packages/mason-commands/versions.json" 2>/dev/null)
REQUIRED_MIN=$(echo "$REMOTE" | jq -r ".commands.\"${COMMAND_NAME}\".required_minimum // \"\"" 2>/dev/null)
BREAKING_REASON=$(echo "$REMOTE" | jq -r ".commands.\"${COMMAND_NAME}\".breaking_reason // \"\"" 2>/dev/null)

echo "=== VERSION CHECK ==="
echo "Local: v${LOCAL_VERSION}"
echo "Required minimum: v${REQUIRED_MIN}"

if [ -n "$REQUIRED_MIN" ] && [ -n "$LOCAL_VERSION" ]; then
  if [ "$(printf '%s\n' "$REQUIRED_MIN" "$LOCAL_VERSION" | sort -V | head -n1)" = "$LOCAL_VERSION" ] && \
     [ "$LOCAL_VERSION" != "$REQUIRED_MIN" ]; then
    echo "STATUS: OUTDATED - AUTO-UPDATING..."
    echo "Reason: $BREAKING_REASON"
  else
    echo "STATUS: OK"
  fi
fi
echo "===================="
```

**IF OUTDATED:** Invoke `/mason-update`, wait, re-read this file, restart.

---

## STEP 2: Repository Validation (BLOCKING - BEFORE ANY ANALYSIS)

```bash
# Read config
apiKey=$(jq -r '.apiKey' mason.config.json)
supabaseUrl=$(jq -r '.supabaseUrl' mason.config.json)
supabaseAnonKey=$(jq -r '.supabaseAnonKey' mason.config.json)
dashboardUrl=$(jq -r '.dashboardUrl // "https://mason.assuredefi.com"' mason.config.json)

# Validate API key and get user context
VALIDATION=$(curl -s -X POST "${dashboardUrl}/api/v1/analysis" \
  -H "Authorization: Bearer ${apiKey}" \
  -H "Content-Type: application/json")

USER_ID=$(echo "$VALIDATION" | jq -r '.user_id')
REPOSITORIES=$(echo "$VALIDATION" | jq -r '.repositories')

# Match git remote to connected repository
GIT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
REPO_FULL_NAME=$(echo "$GIT_REMOTE" | sed -E 's/\.git$//' | sed -E 's|.*github\.com[:/]||')
REPOSITORY_ID=$(echo "$REPOSITORIES" | jq -r --arg name "$REPO_FULL_NAME" '.[] | select(.github_full_name == $name) | .id // empty')

echo "=== REPOSITORY VALIDATION ==="
echo "Git remote: $GIT_REMOTE"
echo "Repo name: $REPO_FULL_NAME"
echo "Repository ID: $REPOSITORY_ID"
echo "============================="
```

### HARD STOP - Repository ID Required

```bash
if [ -z "$REPOSITORY_ID" ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════════╗"
  echo "║                    HARD STOP: REPOSITORY NOT CONNECTED                   ║"
  echo "║                                                                          ║"
  echo "║  This repository is not connected to Mason.                              ║"
  echo "║  Items created without repository_id will NOT appear in dashboard.       ║"
  echo "║                                                                          ║"
  echo "║  TO FIX: Connect this repository at:                                     ║"
  echo "║    ${dashboardUrl}/settings/github                                       ║"
  echo "║                                                                          ║"
  echo "║  Then re-run /pm-review                                                  ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  exit 1
fi
```

---

## STEP 3: Parse Focus Context (Optional)

```bash
FOCUS_CONTEXT=""
if echo "$*" | grep -q "Focus on:"; then
  FOCUS_CONTEXT=$(echo "$*" | sed -n 's/.*Focus on: *\(.*\)/\1/p')
fi

echo "=== FULL REVIEW CONFIGURATION ==="
echo "MODE: full"
echo "FOCUS_CONTEXT: ${FOCUS_CONTEXT:-entire codebase}"
echo "=================================="
```

---

## STEP 4: Launch 8 Agents (Parallel, ITEM_LIMIT=3 each)

Launch ALL 8 agents in ONE message. Each returns exactly 3 items.

| Agent        | subagent_type   | ITEM_LIMIT | INCLUDE_BANGER |
| ------------ | --------------- | ---------- | -------------- |
| Feature      | general-purpose | 3          | true           |
| UI           | general-purpose | 3          | false          |
| UX           | general-purpose | 3          | false          |
| API          | general-purpose | 3          | false          |
| Data         | general-purpose | 3          | false          |
| Security     | general-purpose | 3          | false          |
| Performance  | general-purpose | 3          | false          |
| Code Quality | general-purpose | 3          | false          |

**Agent Prompt Template:**

```
You are a PM agent specializing in [CATEGORY].

Analyze this codebase and find the TOP 3 most important improvements in your domain.
${FOCUS_CONTEXT ? 'Focus your analysis on: ' + FOCUS_CONTEXT : ''}

Return exactly 3 items with:
- title: string
- problem: string
- solution: string
- type: "[category]"
- area: string (affected codebase area)
- impact_score: 1-10
- effort_score: 1-10
- complexity: 1-5
- is_new_feature: boolean
- is_banger_idea: ${INCLUDE_BANGER ? 'true for your BEST idea' : 'false'}

Rank by impact. Return your 3 BEST findings.
```

---

## STEP 5: Aggregate Results

Wait for all 8 agents. Combine results:

- 24 regular items (3 from each category)
- 1 banger (from Feature agent with `is_banger_idea=true`)

**Total: 25 items**

Check duplicates against existing backlog:

```bash
EXISTING=$(curl -s "${supabaseUrl}/rest/v1/mason_pm_backlog_items?select=id,title&or=(status.eq.new,status.eq.approved)&repository_id=eq.${REPOSITORY_ID}" \
  -H "apikey: ${supabaseAnonKey}")
```

- title_similarity >= 70% → DUPLICATE (remove)

---

## STEP 6: Generate PRD for EACH Item (25 PRDs)

For each of the 25 items:

```markdown
# PRD: [Title]

## Problem Statement

[Expanded from item.problem]

## Proposed Solution

[Expanded from item.solution]

## Success Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Approach

### Wave 1: Exploration

| #   | Subagent | Task              |
| --- | -------- | ----------------- |
| 1.1 | Explore  | Research patterns |

### Wave 2: Implementation

| #   | Subagent        | Task      |
| --- | --------------- | --------- |
| 2.1 | general-purpose | Implement |

## Risks & Mitigations

| Risk   | Mitigation   |
| ------ | ------------ |
| [Risk] | [Mitigation] |

## Out of Scope

- [Excluded items]
```

Store: `item.prd_content = prd`

---

## STEP 7: Generate 5 Benefits for EACH Item (25 × 5 = 125 benefits)

For each item:

```json
{
  "benefits": [
    {
      "category": "user_experience",
      "icon": "user",
      "title": "USER EXPERIENCE",
      "description": "[Specific to this item]"
    },
    {
      "category": "sales_team",
      "icon": "users",
      "title": "SALES TEAM",
      "description": "[Specific to this item]"
    },
    {
      "category": "operations",
      "icon": "settings",
      "title": "OPERATIONS",
      "description": "[Specific to this item]"
    },
    {
      "category": "performance",
      "icon": "chart",
      "title": "PERFORMANCE",
      "description": "[Specific to this item]"
    },
    {
      "category": "reliability",
      "icon": "wrench",
      "title": "RELIABILITY",
      "description": "[Specific to this item]"
    }
  ]
}
```

---

## STEP 8: Risk Analysis for EACH Item

Calculate `risk_score` (1-10) for each based on:

- Files affected
- Breaking changes potential
- Test coverage gaps
- Integration complexity

---

## STEP 9: Evidence Validation

For each item:

- `verified`: Problem exists → keep
- `refuted`: Problem doesn't exist → REMOVE
- `inconclusive`: Uncertain → flag

---

## STEP 10: Validation Gate (BLOCKING)

```bash
echo "=== VALIDATION GATE (Full Mode) ==="

TOTAL=<count>
BANGER_COUNT=<is_banger_idea true count>
PRD_COUNT=<items with prd_content count>
BENEFITS_COUNT=<items with 5 benefits count>
RISK_COUNT=<items with risk_score count>

[ "$TOTAL" -gt 25 ] && echo "BLOCKED: Max 25 items (got $TOTAL)" && exit 1
[ "$BANGER_COUNT" -ne 1 ] && echo "BLOCKED: Need exactly 1 banger (got $BANGER_COUNT)" && exit 1
[ "$PRD_COUNT" -ne "$TOTAL" ] && echo "BLOCKED: Missing PRDs ($PRD_COUNT/$TOTAL)" && exit 1
[ "$BENEFITS_COUNT" -ne "$TOTAL" ] && echo "BLOCKED: Missing benefits ($BENEFITS_COUNT/$TOTAL)" && exit 1
[ "$RISK_COUNT" -ne "$TOTAL" ] && echo "BLOCKED: Missing risk scores ($RISK_COUNT/$TOTAL)" && exit 1

echo "PASSED: All validations complete"
echo "===================================="
```

**If ANY fails: Fix before proceeding.**

---

## STEP 11: Submit

### Create Analysis Run

```bash
ANALYSIS_RUN_ID=$(uuidgen)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

curl -s -X POST "${supabaseUrl}/rest/v1/mason_pm_analysis_runs" \
  -H "apikey: ${supabaseAnonKey}" \
  -H "Authorization: Bearer ${supabaseAnonKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "'${ANALYSIS_RUN_ID}'",
    "mode": "full",
    "items_found": '${TOTAL}',
    "status": "completed",
    "repository_id": "'${REPOSITORY_ID}'"
  }'
```

### Insert Items

```bash
curl -s -X POST "${supabaseUrl}/rest/v1/mason_pm_backlog_items" \
  -H "apikey: ${supabaseAnonKey}" \
  -H "Authorization: Bearer ${supabaseAnonKey}" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "analysis_run_id": "'${ANALYSIS_RUN_ID}'",
      "repository_id": "'${REPOSITORY_ID}'",
      "user_id": "'${USER_ID}'",
      "title": "...",
      "problem": "...",
      "solution": "...",
      "type": "...",
      "area": "...",
      "impact_score": X,
      "effort_score": X,
      "complexity": X,
      "benefits": [...5 objects...],
      "is_new_feature": true/false,
      "is_banger_idea": true/false,
      "status": "new",
      "prd_content": "# PRD: ...",
      "prd_generated_at": "'${TIMESTAMP}'",
      "risk_score": X,
      "evidence_status": "verified"
    }
    // ... 25 items total
  ]'
```

---

## STEP 12: Output

```markdown
## Full Review Complete

**Mode**: full
**Items**: 25 / 25
**PRDs**: 100%

### Validation

| Check    | Status     |
| -------- | ---------- |
| Count    | PASS (25)  |
| Banger   | PASS (1)   |
| PRDs     | PASS (25)  |
| Benefits | PASS (125) |
| Risk     | PASS (25)  |

### Items by Category

| Category     | Count | Avg Impact |
| ------------ | ----- | ---------- |
| feature      | 3     | 8.3        |
| ui           | 3     | 7.0        |
| ux           | 3     | 7.7        |
| api          | 3     | 6.3        |
| data         | 3     | 6.7        |
| security     | 3     | 8.0        |
| performance  | 3     | 7.3        |
| code-quality | 3     | 5.7        |

### Top 10 by Priority

| #   | Title   | Type    | Impact | Effort | Priority |
| --- | ------- | ------- | ------ | ------ | -------- |
| 1   | [Title] | feature | 9      | 2      | 16       |

...

### Next Steps

1. View: ${dashboardUrl}/admin/backlog
2. Approve items
3. Run /execute-approved
```

---

## Scoring Reference

| Score | Impact (1-10)  | Effort (1-10) |
| ----- | -------------- | ------------- |
| 9-10  | Critical/major | Weeks         |
| 7-8   | Significant    | Days          |
| 5-6   | Moderate       | Day or two    |
| 3-4   | Nice to have   | Hours         |
| 1-2   | Minor          | Minutes       |

**Priority:** `(Impact × 2) - Effort`

---

## Category Reference

| Category     | Type Badge  |
| ------------ | ----------- |
| feature      | Purple+Star |
| ui           | Gold        |
| ux           | Cyan        |
| api          | Green       |
| data         | Blue        |
| security     | Red         |
| performance  | Orange      |
| code-quality | Gray        |

---

## False Positive Prevention

Before flagging security issues:

1. `git ls-files <file>` - tracked?
2. `.gitignore` excludes it?
3. Real secrets or placeholders?

**Avoid:** `.env.example`, `NEXT_PUBLIC_*`, test fixtures, gitignored files
