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

## Constraint: Parameterised SQL Interval Values Break Dialect Translators
**Domain**: general
**Discovered**: 2026-04-14
**Type**: constraint
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Valid-Until**: ongoing
**Context**: Review of health-checker dual-backend (SQLite/Postgres) abstraction. `getUptimePercentage` and `getRecentAlertCount` pass the interval as a bound parameter (`datetime('now', ?)`), not inline. The translate() regex only matched `datetime('now', '...')` literals, so the Postgres output was `(NOW() - INTERVAL '? hours')::TEXT` — a syntax error.
**Pattern**: When writing SQL dialect translators, parameterised interval values (passed as `?` / `$N`) CANNOT be translated by a regex on the SQL string alone. Either (a) inline the interval into the SQL (compute it in the application layer as an ISO timestamp), or (b) use a native cast: `(NOW() - ($N || ' hours')::INTERVAL)`. Flag any `datetime('now', ?)` pattern in review.
**Why**: The bug produces a hard Postgres syntax error at runtime on every query that uses it, but passes all tests run on SQLite.

## Constraint: Async Singleton Must Assign Before Awaiting to Prevent Concurrent Init Race
**Domain**: general
**Discovered**: 2026-04-14
**Type**: constraint
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Valid-Until**: ongoing
**Context**: Review of health-checker db.ts singleton initialisation. `getClient()` checked `if (_client) return _client` then called `await pgClient.execute(PG_SCHEMA)` before assigning `_client`. Multiple concurrent requests all saw `null`, created parallel pools, and ran DDL simultaneously.
**Pattern**: For async singletons, assign the *promise* (not the resolved value) to the cache variable before the first `await`. Pattern: `if (!_promise) _promise = initFn(); return _promise;`. Never gate on the resolved value after an async operation.
**Why**: Between the null check and the assignment, all concurrent callers pass the guard and create duplicate instances. The resolved-value gate cannot close the window that the promise-gate does.

## Pattern: @types/* Packages Belong in devDependencies
**Domain**: general
**Discovered**: 2026-04-14
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Review of health-checker package.json — @types/pg placed in dependencies instead of devDependencies.
**Pattern**: Any `@types/*` package ships only TypeScript declaration files with no runtime code. Flag placement in `dependencies` as a Warning in every review. They belong in `devDependencies` alongside the TypeScript compiler.
**Why**: Bloats the production install unnecessarily and signals incorrect intent about runtime vs compile-time dependencies.
