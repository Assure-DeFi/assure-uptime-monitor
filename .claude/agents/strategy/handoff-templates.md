# Handoff Templates

Structured formats for agent-to-agent context passing.

---

## Standard Handoff (Agent → Agent)

```markdown
# Handoff: [From Agent] → [To Agent]

## Context
- **Task**: [description]
- **Phase**: [Discovery/Build/QA/etc.]

## What Was Done
[Summary of completed work]

## What Needs to Happen Next
[Specific task with acceptance criteria]

## Files to Reference
- `[path]`: [why this file matters]

## Constraints
- [Hard rules or limitations]

## Expected Deliverable
[What the receiving agent should return]
```

---

## QA PASS

```markdown
# QA PASS: [Task Title]
## Verdict: PASS

## Evidence
- Build: passed
- Tests: [N/N] passed
- Code Review: no critical issues

## Ready For
- [ ] Human review (if needed)
- [x] Merge-ready
```

---

## QA FAIL

```markdown
# QA FAIL: [Task Title]
## Verdict: FAIL
## Attempt: [1/2/3] of 3

## Issues Found
### Issue 1: [Title]
- **Where**: [File:line]
- **Expected**: [What should happen]
- **Actual**: [What actually happens]
- **Fix Suggestion**: [Specific code change]

## What Passed
[Checks that DID pass]

## Fix Instructions
[Actionable steps for the builder]
```

---

## Escalation Report (Agent → Human)

```markdown
# Escalation: [Task Title]
## Reason: 3 failed attempts

## Attempt History
### Attempt 1
- **Approach**: [What was tried]
- **Result**: [Why it failed]

### Attempt 2-3: [same format]

## Root Cause Analysis
[Best assessment of why this keeps failing]

## Recommended Resolution
[What a human should do]
```

---

## Task Completion (Dev Team Lead → User)

```markdown
# Complete: [Task Title]

## Summary
[1-2 sentences]

## Changes
| File | Change |
|------|--------|
| `[path]` | [What changed] |

## Quality Evidence
- Build: PASS
- Tests: [N/N] passed
- Code Review: [verdict]
- QA Loops: [N] attempts

## Ready to Merge: [YES/NO]
```
