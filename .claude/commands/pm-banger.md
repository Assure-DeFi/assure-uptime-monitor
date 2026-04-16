---
name: pm-banger
version: 3.0.0
description: Generate ONE game-changing feature idea with deep analysis
---

# PM Banger Command

Generate exactly **1 transformative banger idea** with full PRD, benefits, and risk analysis.

---

## STEP 1: Version Check (BLOCKING)

```bash
COMMAND_NAME="pm-banger"
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
  echo "║  Then re-run /pm-banger                                                  ║"
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

echo "=== BANGER CONFIGURATION ==="
echo "FOCUS_CONTEXT: ${FOCUS_CONTEXT:-entire codebase}"
echo "============================="
```

---

## STEP 4: Deep Codebase Understanding (3 Parallel Agents)

Launch 3 Explore agents in ONE message:

```
Agent 1 (Explore): "Analyze the architecture and main patterns in this codebase. ${FOCUS_CONTEXT ? 'Focus on: ' + FOCUS_CONTEXT : ''}"
Agent 2 (Explore): "Study user flows and identify pain points. ${FOCUS_CONTEXT ? 'Focus on: ' + FOCUS_CONTEXT : ''}"
Agent 3 (Explore): "Find feature gaps and missing capabilities. ${FOCUS_CONTEXT ? 'Focus on: ' + FOCUS_CONTEXT : ''}"
```

Wait for all 3 to complete. Aggregate findings.

---

## STEP 5: Generate 10 Big Ideas

```
subagent_type: "feature-ideation"
prompt: |
  Based on codebase analysis, generate 10 BIG IDEAS.
  ${FOCUS_CONTEXT ? 'All ideas must be relevant to: ' + FOCUS_CONTEXT : ''}

  These are NOT:
  - Bug fixes
  - Performance tweaks
  - UI adjustments

  These ARE:
  - Game-changing features
  - "Holy shit" innovations
  - Capabilities that don't exist yet

  Return for each:
  - title: string
  - vision: string (2-3 sentences)
  - wow_factor: 1-10
  - user_value: string
  - complexity_estimate: 1-5
```

---

## STEP 6: Select THE Banger

```
subagent_type: "general-purpose"
prompt: |
  From these 10 ideas, pick THE ONE that is:
  - BEST: Highest quality solution
  - BRIGHTEST: Most innovative
  - BIGGEST impact: Transforms user experience
  - Technically feasible: Can be built with current stack
  ${FOCUS_CONTEXT ? '- Most relevant to: ' + FOCUS_CONTEXT : ''}

  Return:
  - selected_title: string
  - justification: string (why this one beats the others)
  - rejected_summary: list of 9 rejected titles with brief reason each
```

---

## STEP 7: Generate PRD for Banger (MANDATORY)

```markdown
# PRD: [Selected Banger Title]

## Problem Statement

[Why this capability doesn't exist and why users need it]

## Proposed Solution

[Detailed description of the feature]

## Success Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Technical Approach

### Wave 1: Foundation

| #   | Subagent | Task                        |
| --- | -------- | --------------------------- |
| 1.1 | Explore  | Research architecture       |
| 1.2 | Explore  | Identify integration points |

### Wave 2: Implementation

| #   | Subagent        | Task               |
| --- | --------------- | ------------------ |
| 2.1 | general-purpose | Build core feature |
| 2.2 | general-purpose | Add UI components  |

### Wave 3: Polish

| #   | Subagent        | Task        |
| --- | --------------- | ----------- |
| 3.1 | general-purpose | Add tests   |
| 3.2 | code-reviewer   | Review code |

## Risks & Mitigations

| Risk            | Mitigation       |
| --------------- | ---------------- |
| [Specific risk] | [How to address] |

## Out of Scope

- [What this feature will NOT include]
```

Store: `item.prd_content = prd`

---

## STEP 8: Generate 5 Benefits (MANDATORY)

```json
{
  "benefits": [
    {
      "category": "user_experience",
      "icon": "user",
      "title": "USER EXPERIENCE",
      "description": "[Transformative benefit for end users]"
    },
    {
      "category": "sales_team",
      "icon": "users",
      "title": "SALES TEAM",
      "description": "[Revenue or conversion impact]"
    },
    {
      "category": "operations",
      "icon": "settings",
      "title": "OPERATIONS",
      "description": "[Operational efficiency gain]"
    },
    {
      "category": "performance",
      "icon": "chart",
      "title": "PERFORMANCE",
      "description": "[New capability or capacity]"
    },
    {
      "category": "reliability",
      "icon": "wrench",
      "title": "RELIABILITY",
      "description": "[System quality improvement]"
    }
  ]
}
```

---

## STEP 9: Risk Analysis

Calculate `risk_score` (1-10) based on:

- Files affected (more = higher risk)
- Breaking changes potential
- Test coverage gaps
- Integration complexity

Set `evidence_status` to `verified` (confirmed feature doesn't exist).

---

## STEP 10: Validation Gate (BLOCKING)

```bash
echo "=== VALIDATION GATE (Banger Mode) ==="

TOTAL=1
HAS_PRD=$([ -n "$PRD_CONTENT" ] && echo "true" || echo "false")
HAS_BENEFITS=$([ "$BENEFITS_COUNT" -eq 5 ] && echo "true" || echo "false")
HAS_RISK=$([ -n "$RISK_SCORE" ] && echo "true" || echo "false")
IS_BANGER=true

[ "$TOTAL" -ne 1 ] && echo "BLOCKED: Must be exactly 1 item" && exit 1
[ "$HAS_PRD" != "true" ] && echo "BLOCKED: Missing PRD" && exit 1
[ "$HAS_BENEFITS" != "true" ] && echo "BLOCKED: Need exactly 5 benefits" && exit 1
[ "$HAS_RISK" != "true" ] && echo "BLOCKED: Missing risk score" && exit 1

echo "PASSED: All validations complete"
echo "======================================"
```

---

## STEP 11: Display Selection

```markdown
## Banger Selection Complete

### THE SELECTED BANGER

**Title:** [Title]
**Vision:** [Description]
**Why This One:** [Justification]

### Rejected Candidates (9 NOT selected)

| #   | Title     | Why Not        |
| --- | --------- | -------------- |
| 1   | [Title 1] | [Brief reason] |
| 2   | [Title 2] | [Brief reason] |

...

_Note: Rejected ideas shown for transparency only. NOT stored._
```

---

## STEP 12: Submit

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
    "mode": "banger",
    "items_found": 1,
    "status": "completed",
    "repository_id": "'${REPOSITORY_ID}'"
  }'
```

### Insert Banger Item

```bash
curl -s -X POST "${supabaseUrl}/rest/v1/mason_pm_backlog_items" \
  -H "apikey: ${supabaseAnonKey}" \
  -H "Authorization: Bearer ${supabaseAnonKey}" \
  -H "Content-Type: application/json" \
  -d '[{
    "analysis_run_id": "'${ANALYSIS_RUN_ID}'",
    "repository_id": "'${REPOSITORY_ID}'",
    "user_id": "'${USER_ID}'",
    "title": "[Banger Title]",
    "problem": "[Problem statement]",
    "solution": "[Solution description]",
    "type": "feature",
    "area": "[Affected area]",
    "impact_score": [8-10],
    "effort_score": [effort],
    "complexity": [1-5],
    "benefits": [5 benefit objects],
    "is_new_feature": true,
    "is_banger_idea": true,
    "status": "new",
    "prd_content": "[Full PRD markdown]",
    "prd_generated_at": "'${TIMESTAMP}'",
    "risk_score": [1-10],
    "evidence_status": "verified"
  }]'
```

---

## STEP 13: Output

```markdown
## Banger Review Complete

**Mode**: banger
**Items**: 1 / 1
**PRDs**: 100%

### Validation

| Check    | Status   |
| -------- | -------- |
| Count    | PASS (1) |
| Banger   | PASS     |
| PRD      | PASS     |
| Benefits | PASS (5) |
| Risk     | PASS     |

### The Banger

| Title   | Impact | Effort | Priority |
| ------- | ------ | ------ | -------- |
| [Title] | [9]    | [X]    | [Score]  |

### Next Steps

1. View: ${dashboardUrl}/admin/backlog
2. Review and approve the banger
3. Run /execute-approved
```
