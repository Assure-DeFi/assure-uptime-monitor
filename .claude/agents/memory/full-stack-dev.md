# full-stack-dev Memory

Persistent memory for the full-stack-dev agent. Append learnings here.

---

## Pattern: Negative Keyword Convention in checker.ts
**Domain**: dashboard
**Discovered**: 2026-04-14
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Added content verification to monitor configs; needed to distinguish "must contain" from "must NOT contain" keywords without a schema change.
**Pattern**: `expected_keyword` prefixed with `!` signals a forbidden keyword. The checker strips the `!`, searches case-insensitively, and fails the check if the keyword IS found. `keywordFound` is set to 0 (bad) when the forbidden word is present. The condition gate was also simplified from `check_type === "keyword" || check_type === "json"` to a plain `if (monitor.expected_keyword)` so keyword validation applies to any check_type that declares one.
**Why**: Allows monitor configs to express negative assertions (e.g., Bubble maintenance mode detection) using only the existing `expected_keyword` string field — no schema migration required.
