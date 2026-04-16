---
name: pm-quick
version: 3.0.0
description: Quick pulse check - 9 items (8 regular + 1 banger)
---

# PM Quick Command

Fast scan returning **9 items** (1 from each of 8 categories + 1 banger).

---

## STEP 1: Version Check (BLOCKING)

```bash
COMMAND_NAME="pm-quick"
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
  echo "║  Then re-run /pm-quick                                                   ║"
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

echo "=== QUICK CONFIGURATION ==="
echo "FOCUS_CONTEXT: ${FOCUS_CONTEXT:-entire codebase}"
echo "==========================="
```

---

## STEP 4: Launch 8 Agents (Parallel, ITEM_LIMIT=1 each)

Launch ALL 8 agents in ONE message. Each returns exactly 1 item.

| Agent        | subagent_type   | ITEM_LIMIT | INCLUDE_BANGER |
| ------------ | --------------- | ---------- | -------------- |
| Feature      | general-purpose | 1          | true           |
| UI           | general-purpose | 1          | false          |
| UX           | general-purpose | 1          | false          |
| API          | general-purpose | 1          | false          |
| Data         | general-purpose | 1          | false          |
| Security     | general-purpose | 1          | false          |
| Performance  | general-purpose | 1          | false          |
| Code Quality | general-purpose | 1          | false          |

**Agent Prompt Template:**

```
You are a PM agent specializing in [CATEGORY].

Analyze this codebase and find the SINGLE MOST IMPORTANT improvement opportunity in your domain.
${FOCUS_CONTEXT ? 'Focus your analysis on: ' + FOCUS_CONTEXT : ''}

Return exactly 1 item with:
- title: string
- problem: string
- solution: string
- type: "[category]"
- area: string (affected codebase area)
- impact_score: 1-10
- effort_score: 1-10
- complexity: 1-5
- is_new_feature: boolean
- is_banger_idea: ${INCLUDE_BANGER}

IMPORTANT: Return your SINGLE BEST finding, not multiple options.
```

---

## STEP 5: Aggregate Results

Wait for all 8 agents. Combine results:

- 8 regular items (1 from each category)
- 1 banger (from Feature agent with `is_banger_idea=true`)

**Total: 9 items**

Check duplicates against existing backlog:

```bash
EXISTING=$(curl -s "${supabaseUrl}/rest/v1/mason_pm_backlog_items?select=id,title&or=(status.eq.new,status.eq.approved)&repository_id=eq.${REPOSITORY_ID}" \
  -H "apikey: ${supabaseAnonKey}")
```

- title_similarity >= 70% → DUPLICATE (remove)

---

## STEP 6: Generate PRD for EACH Item (9 PRDs)

For each of the 9 items, generate:

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

## STEP 7: Generate 5 Benefits for EACH Item (9 × 5 = 45 benefits)

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
echo "=== VALIDATION GATE (Quick Mode) ==="

TOTAL=<count>
BANGER_COUNT=<is_banger_idea true count>
PRD_COUNT=<items with prd_content count>
BENEFITS_COUNT=<items with 5 benefits count>
RISK_COUNT=<items with risk_score count>

[ "$TOTAL" -gt 9 ] && echo "BLOCKED: Max 9 items (got $TOTAL)" && exit 1
[ "$BANGER_COUNT" -ne 1 ] && echo "BLOCKED: Need exactly 1 banger (got $BANGER_COUNT)" && exit 1
[ "$PRD_COUNT" -ne "$TOTAL" ] && echo "BLOCKED: Missing PRDs ($PRD_COUNT/$TOTAL)" && exit 1
[ "$BENEFITS_COUNT" -ne "$TOTAL" ] && echo "BLOCKED: Missing benefits ($BENEFITS_COUNT/$TOTAL)" && exit 1
[ "$RISK_COUNT" -ne "$TOTAL" ] && echo "BLOCKED: Missing risk scores ($RISK_COUNT/$TOTAL)" && exit 1

echo "PASSED: All validations complete"
echo "===================================="
```

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
    "mode": "quick",
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
    // ... 9 items total
  ]'
```

---

## STEP 12: Output

```markdown
## Quick Review Complete

**Mode**: quick
**Items**: 9 / 9
**PRDs**: 100%

### Validation

| Check    | Status    |
| -------- | --------- |
| Count    | PASS (9)  |
| Banger   | PASS (1)  |
| PRDs     | PASS (9)  |
| Benefits | PASS (45) |
| Risk     | PASS (9)  |

### Items

| #   | Title   | Type    | Impact | Effort | Priority |
| --- | ------- | ------- | ------ | ------ | -------- |
| 1   | [Title] | feature | 9      | 2      | 16       |
| 2   | [Title] | ui      | 7      | 3      | 11       |

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
