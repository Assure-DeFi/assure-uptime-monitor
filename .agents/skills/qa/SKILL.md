---
name: qa
description: Tiered quality gate before commits. Runs mechanical checks always, dispatches Code Reviewer on multi-file changes, adds Reality Checker + Evidence Collector for features/UI.
agents:
  code-review: "Code Reviewer"
  challenger: "Engineering Challenger"
  reality-check: "Reality Checker"
  evidence: "Evidence Collector"
  adversary: "Adversary"
---

# /qa — Tiered Quality Gate

Run quality checks scaled to the size and type of changes. Execute BEFORE committing.

## Step 1: Analyze the Change Scope

```bash
git diff --name-only HEAD
git diff --stat HEAD
git diff --diff-filter=A --name-only HEAD
```

Determine:
- **Files changed**: count
- **Lines changed**: total
- **File types**: TypeScript, SQL, JSON, Markdown
- **UI components touched?**: files in `dashboard/src/components/`, `dashboard/src/app/`, or containing JSX/TSX
- **New files created?**
- **Feature or bug fix?**: infer from task context

## Step 2: Select QA Tier

| Tier | Criteria | What Runs |
|---|---|---|
| **Mechanical** | Single-file change under 20 lines | Compiler/linter checks only — no agents |
| **Standard** | Multi-file changes OR 20+ lines in a single file | Mechanical + Code Reviewer + Issue Validation Gate |
| **Full** | New files created, UI components touched, new feature, OR user says "full review" | Standard + Reality Checker + Evidence Collector + Adversary |

**Tier is determined by the highest matching criterion.** If any condition for a higher tier is met, use that tier.

### Critical Path Gate (ALL tiers — runs after Mechanical passes)

**Every /qa run — regardless of tier — MUST verify that changes don't break Critical User Journeys (CUJs).** This is a fast, targeted check.

**How it works:**
1. Map changed files to affected CUJs (see table below)
2. Run ONLY the affected journey's build check
3. If no file-to-journey mapping matches, skip this gate

**File-to-CUJ Mapping:**

| Changed file pattern | Affected Journey | Check command |
|---|---|---|
| `dashboard/src/**` | Dashboard: Build + Render | `cd dashboard && npx tsc --noEmit` |
| `outreach-bot/src/**` | Outreach: Build | `cd outreach-bot && npx tsc -p tsconfig.build.json --noEmit` |
| `lead-enrichment/src/**` | Enrichment: Build | `cd lead-enrichment && npx tsc -p tsconfig.build.json --noEmit` |
| `supabase/migrations/**` | Schema: SQL Syntax | SQL syntax validation + trigger impact check |

**If the Critical Path Gate fails, the change is BLOCKED regardless of tier.** Fix the regression before proceeding.

## Step 2.5: Dependency Check (runs once per session)

Before executing any checks, verify that testing tools are installed. **If any check fails, install the missing dependency before proceeding.**

```bash
# Core — required for ALL tiers
cd dashboard && node -e "require('@playwright/test')" 2>/dev/null || echo "MISSING: @playwright/test in dashboard"
cd dashboard && npx playwright install --dry-run chromium 2>/dev/null || echo "MISSING: Playwright browsers — run: cd dashboard && npx playwright install chromium"
cd dashboard && node -e "require('vitest')" 2>/dev/null || echo "MISSING: vitest in dashboard"
cd outreach-bot && node -e "require('vitest')" 2>/dev/null || echo "MISSING: vitest in outreach-bot"
cd lead-enrichment && node -e "require('vitest')" 2>/dev/null || echo "MISSING: vitest in lead-enrichment"

# TypeScript — required for Mechanical tier
command -v npx >/dev/null 2>&1 || echo "MISSING: npx (install Node.js)"
cd dashboard && node -e "require('typescript')" 2>/dev/null || echo "MISSING: typescript in dashboard"

# Linting — required for Mechanical tier
cd dashboard && node -e "require('eslint')" 2>/dev/null || echo "MISSING: eslint in dashboard"
```

**If any MISSING lines appear:**

| Missing Tool | Install Command |
|---|---|
| `@playwright/test` | `cd dashboard && npm install` |
| Playwright browsers | `cd dashboard && npx playwright install chromium` |
| `vitest` (any package) | `cd <package> && npm install` |
| `typescript` | `cd <package> && npm install` |
| `eslint` | `cd dashboard && npm install` |
| `npx` | Install Node.js 18+ |

**Do NOT skip this step.** Agents that rely on Playwright (Evidence Collector, Adversary) or test runners (Reality Checker) will fail silently or produce misleading results if their tools are missing. Fix all missing dependencies before proceeding to Step 3.

## Step 3: Execute

**CRITICAL: All Agent dispatches in this skill MUST use `subagent_type` set to the exact agent name and include `mode: "bypassPermissions"`.**

### Mechanical (always runs)

```bash
# Run for affected packages:
cd dashboard && npx tsc --noEmit                           # Dashboard
cd outreach-bot && npx tsc -p tsconfig.build.json --noEmit # Outreach-bot
cd lead-enrichment && npx tsc -p tsconfig.build.json --noEmit # Lead-enrichment
```

**If any check fails, STOP.** Fix the errors before proceeding to higher tiers.

### Standard (adds Code Reviewer + Issue Validation Gate)

After Mechanical passes, dispatch the **Code Reviewer** agent:

```
Agent(
  subagent_type: "Code Reviewer",
  mode: "bypassPermissions",
  model: "sonnet",
  prompt: "Review the following changes for correctness, style, edge cases, and regression risk.\n[include the git diff or describe the changes]"
)
```

If the Code Reviewer identifies **blocking issues**, proceed to the **Issue Validation Gate** before attempting any fixes.

### Issue Validation Gate (Standard+ — runs after Code Review)

Before fixing ANY issue the Code Reviewer flagged, dispatch the **Engineering Challenger** to validate findings:

```
Agent(
  subagent_type: "Engineering Challenger",
  mode: "bypassPermissions",
  model: "sonnet",
  prompt: "Validate the following Code Review findings. For EACH flagged issue, determine if it's a real issue or a false positive, assess blast radius, and deliver a verdict (CONFIRMED / FALSE_POSITIVE / RISKY_FIX / DEFERRED).

Code Review findings:
[include the Code Review findings here]

Git diff for context:
[include the git diff]"
)
```

**Gate rules:**
- Only **CONFIRMED** issues proceed to fix attempts
- **FALSE_POSITIVE** issues are dropped — do NOT fix them
- **RISKY_FIX** issues use the Challenger's safer alternative, not the original suggestion
- **DEFERRED** issues are noted in the QA report but not acted on
- If ALL issues are FALSE_POSITIVE, skip fixes entirely — Code Review passes

After validated fixes are applied, re-run Mechanical checks. Max 3 fix-retry cycles total.

### Full (adds Reality Checker + Evidence Collector)

After Standard passes, dispatch **in parallel**:

**Reality Checker:**
```
Agent(
  subagent_type: "Reality Checker",
  mode: "bypassPermissions",
  model: "sonnet",
  prompt: "Validate the following changes work end-to-end.
- Test integration points
- Verify against acceptance criteria
- Check for regressions in related functionality

MANDATORY CHECKS (regardless of what changed):
- Every button visible in the changed UI must be clickable and produce a response
- Every form Save/Submit button must complete successfully with valid data
- If the change touches a multi-step flow, verify the LAST step completes — not just the first
- If the change touches a list/sequence, verify the LAST item behaves the same as middle items
- If the change adds a modal/overlay, verify the underlying buttons still work after the overlay closes
[describe what changed]"
)
```

**Evidence Collector** (only if UI components changed):
```
Agent(
  subagent_type: "Evidence Collector",
  mode: "bypassPermissions",
  model: "sonnet",
  prompt: "Capture screenshots of the affected UI at desktop (1920x1080), tablet (768x1024), and mobile (375x812).
- Validate against brand compliance (Navy #0A0724 bg, Gold #E2D243 accents, Inter font)
- Document the visual state
- Capture console errors and failed network requests
[describe which UI components changed]"
)
```

**Adversary** (only when diff touches browser-facing code — `dashboard/src/**`):
```
Agent(
  subagent_type: "Adversary",
  mode: "bypassPermissions",
  model: "sonnet",
  prompt: "Read this git diff and try to break the changes. Generate adversarial scenarios and execute them against the dev server.

GIT DIFF:
[include the full git diff HEAD output]"
)
```

## Step 4: Report Results

```markdown
## QA Results — [Mechanical|Standard|Full]

### Mechanical
- Build: [PASS/FAIL]
- Tests: [PASS/FAIL] — [X/X] passed

### Code Review (Standard+ only)
- Reviewer: [APPROVE/REQUEST CHANGES]
- Blocking issues: [list or "none"]

### Issue Validation (Standard+ only, when Code Review flagged issues)
- Validated: [N] CONFIRMED, [N] FALSE_POSITIVE, [N] RISKY_FIX, [N] DEFERRED
- False positives dropped: [list]
- Fixes applied: [list]

### Integration (Full only)
- Reality Checker: [PASS/NEEDS WORK]
- Evidence Collector: [PASS/FAIL] — [N screenshots]
- Adversary: [PASS/FAIL] — [N scenarios tested, N bugs found]

### Verdict: [READY TO COMMIT / BLOCKED — fix required]
```

## Escalation

If 3 fix-and-retry cycles fail at any tier, **stop and escalate to the user** with:
- What failed and the exact error
- What fixes were attempted
- Root cause analysis
- Recommended path forward
