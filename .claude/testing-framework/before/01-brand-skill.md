# BEFORE Test: Brand Guidelines Skill

## Test Configuration
- **Date**: 2026-01-17
- **Test Prompt**: "Create a new action button component for approving articles in the dashboard"
- **Context**: Working in article-intake project without brand skill loaded
- **Current State**: Brand rules exist in `/brand/` but no skill to auto-load them

---

## Pre-Test Analysis

### Information Available to Claude WITHOUT Skill
1. CLAUDE.md mentions brand files exist but doesn't include the rules
2. Claude must explicitly be told to read brand files
3. No frontmatter triggers or keywords that auto-suggest brand loading

### Predicted Behavior Without Brand Skill

**Tool Calls Expected**:
1. Read existing button.tsx to understand patterns
2. Maybe read brand files IF explicitly instructed in CLAUDE.md
3. Write new component

**Likely Output Issues**:
1. May use generic colors (blue, green, red) instead of brand colors
2. May use rounded-full or pill-shaped buttons (violates DO-NOT.md)
3. May add hover animations (violates DO-NOT.md)
4. May not use Inter font explicitly
5. May use light-mode patterns instead of dark-mode first
6. Won't reference design-tokens.json unless reminded

---

## Simulated Test Run

### Scenario: Claude responds to "Create a new action button component for approving articles in the dashboard"

**Step 1**: Claude reads CLAUDE.md (15 lines, minimal)
```
# Claude Project Instructions
Before any UI, UX, or front-end work:
1. Read /brand/BRAND.md
2. Use /brand/tokens/design-tokens.json for all styling
3. Respect /brand/rules/DO-NOT.md
```

**Step 2**: IF Claude follows instructions, reads brand files
- This requires 3 additional file reads
- Claude must remember to do this every time
- Easy to forget on subsequent tasks

**Step 3**: Claude creates component

**Potential Problems**:
- Context window usage: 3 extra reads every time
- Inconsistent application: some sessions remember, some don't
- No validation: Claude may still make mistakes

---

## Metrics to Track

1. **File Reads Required**: How many brand-related files Claude needs to read
2. **Brand Compliance**: Does output follow all brand rules?
3. **Color Usage**: Are only approved colors used?
4. **Anti-Pattern Violations**: Any pill buttons, gradients, emojis?
5. **Design Token Usage**: Are tokens referenced correctly?

---

## Baseline Observation

Without the brand skill:
- Claude MIGHT follow brand rules if it remembers to read the files
- Every UI task requires re-reading 3+ brand files
- No structured guidance on common patterns
- No examples of correct vs incorrect implementations
- Brand knowledge doesn't persist across conversation context

**Quality Score (Predicted)**: 6/10
- Works if Claude remembers to read brand files
- Fragile - easy to forget or skip
- No enforcement mechanism
