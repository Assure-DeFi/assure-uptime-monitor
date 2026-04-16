# code-reviewer Memory

Persistent memory for the code-reviewer agent. Append learnings here.

---

## Constraint: Views Referenced in Code Must Have Migration Files
**Discovered**: 2026-03-30
**Type**: constraint
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Review of fix/messaging-system PR. `use-outreach.ts` switched from `outreach_messages` to `outreach_messages_with_context` view, but no migration file exists anywhere in the repo to create this view.
**Pattern**: When a PR changes a Supabase table/view reference, verify a migration file exists that creates or alters the referenced object. Search all migration directories (`supabase/`, `dashboard/supabase/`, `lead-enrichment/supabase/`) and git history with `-S`.
**Why**: PostgREST returns 404/400 for non-existent views, breaking the entire feature. The dev-team-lead memory file may mention the view was "created" but the migration SQL must actually exist in the repo.

## Pattern: Duplicate Polling Hooks for Same Data
**Discovered**: 2026-03-30
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Review of messaging system fix. `useMessagingAttentionCount` (sidebar) and `useOutreachStats` (inbox) both poll the same `needs_attention` count independently every 30s.
**Pattern**: When reviewing new polling hooks, check if the same data is already polled elsewhere. Flag duplicate polling as a Warning when both hooks can be active simultaneously on the same page.
**Why**: Doubles query load on Supabase for no benefit. Can also cause UI inconsistency if one poll succeeds and the other fails.

## Pattern: Side Effects in useMemo Are Fragile
**Discovered**: 2026-03-30
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 1
**References**: 1
**Context**: Review of messaging-inbox.tsx `currentSelected` useMemo that resets `justTriagedRef.current = false` inside the memo body.
**Pattern**: Flag ref mutations inside `useMemo` as a Suggestion. They work because refs don't trigger re-renders, but React may skip or double-execute memos in future concurrent features.
**Why**: React docs explicitly discourage side effects in useMemo. Concurrent mode could change execution assumptions.

## Pattern: Merge-by-ID Accumulation Can Grow Unboundedly
**Discovered**: 2026-03-30
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Review of use-outreach.ts merge-by-ID pattern for poll refreshes on page 0 with accumulated pages.
**Pattern**: When using Map-based merge to update existing entries during polls, verify there is a pruning mechanism. Without it, items that leave the current filter set (e.g., triaged out of needs_attention tab) remain in the Map forever, growing the array unboundedly across poll cycles.
**Why**: Memory growth and stale data in the UI. The allMessages array and sorted view will contain items no longer matching the active query.

## Pattern: Dead Query After Source-of-Truth Consolidation
**Discovered**: 2026-03-30
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Review of messaging system -- needsAttentionCount is still queried inside useOutreachMessages even though useMessagingAttentionCount is now the single source of truth for the tab badge.
**Pattern**: When consolidating duplicate data sources to a single hook, verify the old query sites are actually removed. Destructuring a return value that is never used downstream is a telltale sign.
**Why**: Wastes a Supabase query per poll cycle. Also creates potential UI inconsistency if the dead value were accidentally consumed.
