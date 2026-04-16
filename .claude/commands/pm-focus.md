---
name: pm-focus
version: 3.0.0
description: Deep dive into one specific domain - 5 focused items
---

# PM Focus Command

Deep dive into **one specific area** returning **5 focused items**.

**Usage:** `/pm-focus area:security` or `/pm-focus area:performance`

---

## STEP 1: Version Check (BLOCKING)

```bash
COMMAND_NAME="pm-focus"
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
  echo "║  Then re-run /pm-focus                                                   ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  exit 1
fi
```

---

## STEP 3: Parse Area Argument (REQUIRED)

```bash
AREA_TYPE=""
if echo "$*" | grep -qi "area:"; then
  AREA_TYPE=$(echo "$*" | grep -oE "area:[a-z-]+" | cut -d: -f2)
fi

FOCUS_CONTEXT=""
if echo "$*" | grep -q "Focus on:"; then
  FOCUS_CONTEXT=$(echo "$*" | sed -n 's/.*Focus on: *\(.*\)/\1/p')
fi

echo "=== FOCUS CONFIGURATION ==="
echo "AREA_TYPE: $AREA_TYPE"
echo "FOCUS_CONTEXT: ${FOCUS_CONTEXT:-entire codebase}"
echo "==========================="
```

### HARD STOP - Area Required

```bash
VALID_AREAS="feature ui ux api data security performance code-quality"

if [ -z "$AREA_TYPE" ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════════╗"
  echo "║                    ERROR: AREA ARGUMENT REQUIRED                         ║"
  echo "║                                                                          ║"
  echo "║  Usage: /pm-focus area:<type>                                            ║"
  echo "║                                                                          ║"
  echo "║  Valid areas:                                                            ║"
  echo "║    - feature      (net-new functionality)                                ║"
  echo "║    - ui           (visual, styling)                                      ║"
  echo "║    - ux           (user flows, friction)                                 ║"
  echo "║    - api          (endpoints, backend)                                   ║"
  echo "║    - data         (database, queries)                                    ║"
  echo "║    - security     (vulnerabilities, auth)                                ║"
  echo "║    - performance  (speed, caching)                                       ║"
  echo "║    - code-quality (refactors, tech debt)                                 ║"
  echo "║                                                                          ║"
  echo "║  Example: /pm-focus area:security                                        ║"
  echo "╚══════════════════════════════════════════════════════════════════════════╝"
  exit 1
fi

if ! echo "$VALID_AREAS" | grep -qw "$AREA_TYPE"; then
  echo "ERROR: Invalid area '$AREA_TYPE'. Valid: $VALID_AREAS"
  exit 1
fi
```

---

## STEP 4: Launch Single Domain Agent

Launch ONE agent specialized in the selected area:

| AREA_TYPE    | Agent Focus                     |
| ------------ | ------------------------------- |
| feature      | Net-new functionality gaps      |
| ui           | Visual, styling improvements    |
| ux           | User flow friction points       |
| api          | Endpoint and backend issues     |
| data         | Database and query problems     |
| security     | Vulnerabilities and auth gaps   |
| performance  | Speed and caching opportunities |
| code-quality | Tech debt and refactor needs    |

**Agent Prompt:**

```
subagent_type: "general-purpose"
prompt: |
  You are a PM agent specializing in ${AREA_TYPE}.

  Analyze this codebase deeply and find the TOP 5 most important improvements in your domain.
  ${FOCUS_CONTEXT ? 'Focus your analysis on: ' + FOCUS_CONTEXT : ''}

  For ${AREA_TYPE}, look for:
  ${AREA_SPECIFIC_GUIDANCE}

  Return exactly 5 items, each with:
  - title: string
  - problem: string (detailed problem description)
  - solution: string (proposed fix)
  - type: "${AREA_TYPE}"
  - area: string (specific codebase area affected)
  - impact_score: 1-10
  - effort_score: 1-10
  - complexity: 1-5
  - is_new_feature: boolean
  - is_banger_idea: false (no banger in focus mode)

  Rank by impact. Return your 5 BEST findings.
```

**Area-Specific Guidance:**

| Area         | Look For                                                |
| ------------ | ------------------------------------------------------- |
| feature      | Missing capabilities, user requests, competitive gaps   |
| ui           | Inconsistent styling, accessibility issues, visual bugs |
| ux           | Confusing flows, high friction, unclear navigation      |
| api          | Missing endpoints, inconsistent responses, slow calls   |
| data         | N+1 queries, missing indexes, schema issues             |
| security     | Injection risks, auth gaps, data exposure               |
| performance  | Slow pages, missing caching, large bundles              |
| code-quality | Duplicated code, missing types, poor error handling     |

---

## STEP 5: Deduplicate Against Existing

```bash
EXISTING=$(curl -s "${supabaseUrl}/rest/v1/mason_pm_backlog_items?select=id,title&or=(status.eq.new,status.eq.approved)&repository_id=eq.${REPOSITORY_ID}" \
  -H "apikey: ${supabaseAnonKey}")
```

- title_similarity >= 70% → DUPLICATE (remove)
- After dedup, should have ≤5 items

---

## STEP 6: Generate PRD for EACH Item (5 PRDs)

For each of the 5 items:

```markdown
# PRD: [Title]

## Problem Statement

[Expanded from item.problem with specific details]

## Proposed Solution

[Expanded from item.solution with implementation approach]

## Success Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Approach

### Wave 1: Exploration

| #   | Subagent | Task                       |
| --- | -------- | -------------------------- |
| 1.1 | Explore  | Research existing patterns |

### Wave 2: Implementation

| #   | Subagent        | Task              |
| --- | --------------- | ----------------- |
| 2.1 | general-purpose | Implement changes |

## Risks & Mitigations

| Risk   | Mitigation   |
| ------ | ------------ |
| [Risk] | [Mitigation] |

## Out of Scope

- [Excluded items]
```

Store: `item.prd_content = prd`

---

## STEP 7: Generate 5 Benefits for EACH Item (5 × 5 = 25 benefits)

For each item:

```json
{
  "benefits": [
    {
      "category": "user_experience",
      "icon": "user",
      "title": "USER EXPERIENCE",
      "description": "[Specific to this ${AREA_TYPE} improvement]"
    },
    {
      "category": "sales_team",
      "icon": "users",
      "title": "SALES TEAM",
      "description": "[Specific to this ${AREA_TYPE} improvement]"
    },
    {
      "category": "operations",
      "icon": "settings",
      "title": "OPERATIONS",
      "description": "[Specific to this ${AREA_TYPE} improvement]"
    },
    {
      "category": "performance",
      "icon": "chart",
      "title": "PERFORMANCE",
      "description": "[Specific to this ${AREA_TYPE} improvement]"
    },
    {
      "category": "reliability",
      "icon": "wrench",
      "title": "RELIABILITY",
      "description": "[Specific to this ${AREA_TYPE} improvement]"
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
echo "=== VALIDATION GATE (Focus Mode) ==="

TOTAL=<count>
PRD_COUNT=<items with prd_content count>
BENEFITS_COUNT=<items with 5 benefits count>
RISK_COUNT=<items with risk_score count>
BANGER_COUNT=<is_banger_idea true count>

[ "$TOTAL" -gt 5 ] && echo "BLOCKED: Max 5 items (got $TOTAL)" && exit 1
[ "$BANGER_COUNT" -gt 0 ] && echo "WARNING: Focus mode should have no banger (got $BANGER_COUNT)"
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
    "mode": "area",
    "area_type": "'${AREA_TYPE}'",
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
      "type": "'${AREA_TYPE}'",
      "area": "...",
      "impact_score": X,
      "effort_score": X,
      "complexity": X,
      "benefits": [...5 objects...],
      "is_new_feature": true/false,
      "is_banger_idea": false,
      "status": "new",
      "prd_content": "# PRD: ...",
      "prd_generated_at": "'${TIMESTAMP}'",
      "risk_score": X,
      "evidence_status": "verified"
    }
    // ... 5 items total
  ]'
```

---

## STEP 12: Output

```markdown
## Focus Review Complete

**Mode**: focus
**Area**: ${AREA_TYPE}
**Items**: 5 / 5
**PRDs**: 100%

### Validation

| Check    | Status           |
| -------- | ---------------- |
| Count    | PASS (5)         |
| Banger   | N/A (focus mode) |
| PRDs     | PASS (5)         |
| Benefits | PASS (25)        |
| Risk     | PASS (5)         |

### ${AREA_TYPE} Items

| #   | Title   | Impact | Effort | Priority |
| --- | ------- | ------ | ------ | -------- |
| 1   | [Title] | 9      | 2      | 16       |
| 2   | [Title] | 8      | 3      | 13       |

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

## Area Badge Reference

| Area         | Badge Color |
| ------------ | ----------- |
| feature      | Purple+Star |
| ui           | Gold        |
| ux           | Cyan        |
| api          | Green       |
| data         | Blue        |
| security     | Red         |
| performance  | Orange      |
| code-quality | Gray        |
