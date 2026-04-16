# BEFORE Test: PostToolUse Hooks (Auto-Format & Type-Check)

## Test Configuration
- **Date**: 2026-01-17
- **Test Prompt**: "Add a new utility function to format article dates"
- **Context**: Working in article-intake project without PostToolUse hooks
- **Current State**: No automatic formatting or type-checking

---

## Pre-Test Analysis

### Current Quality Enforcement
1. Manual prettier runs (if remembered)
2. Manual tsc checks (if remembered)
3. Build failures catch errors later
4. No immediate feedback on edits

### Predicted Behavior Without Hooks

**Tool Calls Expected**:
1. Read existing utils file
2. Edit to add new function
3. (Claude may or may not run prettier)
4. (Claude may or may not run tsc)

**Likely Issues**:
1. Code may not be formatted consistently
2. Type errors not caught until later
3. Quality depends on Claude's memory
4. Inconsistent workflow across sessions

---

## Simulated Test Run

### Scenario: Claude adds utility function

**Step 1**: Claude reads src/lib/utils.ts

**Step 2**: Claude edits file to add function
```typescript
export function formatArticleDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
```

**Step 3**: Edit completes - NO automatic verification

**Problems**:
- Code may not match project formatting rules
- No type check confirms function is valid
- Claude may forget to run prettier
- Quality inconsistent between sessions

---

## Metrics to Track

1. **Auto-Format**: Is code formatted after edit?
2. **Type-Check**: Are type errors caught immediately?
3. **Consistency**: Does this happen every time?
4. **User Feedback**: Does user see format/type results?

---

## Baseline Observation

Without PostToolUse hooks:
- Formatting is manual and often forgotten
- Type errors caught later in build
- Quality varies by session
- No automated enforcement

**Quality Score (Predicted)**: 5/10
- Code works but may be poorly formatted
- Type errors may slip through
