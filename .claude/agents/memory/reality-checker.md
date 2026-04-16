# reality-checker Memory

Persistent memory for the reality-checker agent. Append learnings here.

---

## Observation: lead-enrichment missing tsconfig.build.json
**Discovered**: 2026-03-30
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Validating messaging system fixes, attempted to build lead-enrichment
**Pattern**: lead-enrichment only has `tsconfig.json`, not `tsconfig.build.json`. The CLAUDE.md says Railway uses tsconfig.build.json for lead-enrichment, but the file doesn't exist in the current branch. Also, `typescript` is not installed as a direct dependency (npx had to download it). Pre-existing env issue, not a regression.
**Why**: Build validation for lead-enrichment requires knowing the correct tsconfig path. Don't block PRs on this if lead-enrichment has no changes.

## Pattern: Dashboard filter consistency check for badge/tab/stats
**Discovered**: 2026-03-30
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Validating messaging system sidebar badge vs attention tab filter
**Pattern**: When a sidebar badge count and a tab filter show the same concept (e.g., "needs attention"), verify the Supabase filter clauses are identical across: (1) the lightweight badge hook, (2) the tab filter function, (3) the stats counter. Different tables/views are acceptable if the row filter is the same, but column name differences between a table and its view could cause silent divergence.
**Why**: A badge showing a different count than the tab it links to erodes user trust. Three separate query locations makes drift likely.

## Pattern: Dashboard filter consistency check for badge/tab/stats
**Discovered**: 2026-03-30
**Type**: pattern
**Supersedes**: 2026-03-30 + "Dashboard filter consistency check for badge/tab/stats" (promoted from observation)
**Invocations-Since**: 0
**References**: 1
**Context**: Second validation of messaging system attention counts confirmed all 3 locations (use-outreach.ts x2, use-messaging-attention.ts) use identical filters
**Pattern**: Attention count is queried in 3 places: useOutreachMessages (inline), useOutreachStats (stats.needs_attention), useMessagingAttentionCount (sidebar badge). All must use `status=replied, reply_quality=unclassified, handled_at IS NULL` on `outreach_messages` table. The inbox uses `useMessagingAttentionCount` for the tab badge, NOT the inline count from useOutreachMessages.
**Why**: Confirmed pattern across two validation sessions. Filter drift between these 3 locations would cause badge/tab count mismatch.

## Observation: Map-based merge preserves old insertion order
**Discovered**: 2026-03-30
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Validating merge-by-ID logic in use-outreach.ts for accumulated pagination
**Pattern**: When merging page-0 poll results into accumulated pages via `new Map(prev).set(new)`, updated messages retain their OLD position in iteration order. The `recent` sort mode returns 0 (no re-sort), so order depends on Map insertion order. This is mitigated by: (1) `prev.length <= limit` short-circuit returns fresh array directly, (2) other sort modes re-sort client-side, (3) 30s poll eventually refreshes.
**Why**: Could cause a briefly stale sort order for messages that received new replies, but self-heals quickly.

## Bug: Parameterized datetime('now', ?) not translated for Postgres
**Domain**: ops
**Discovered**: 2026-04-14
**Type**: constraint
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Validating dual-backend SQLite/Postgres migration in health-checker app
**Pattern**: `translate()` in `buildPgClient` only rewrites INLINE `datetime('now', '-X unit')` patterns. When the interval is a **parameter** (`datetime('now', ?)`), the regex does not match and the raw SQLite call passes through to Postgres, causing a runtime error. Affected functions in db.ts: `getUptimePercentage` (line 404) and `getRecentAlertCount` (line 563). Both pass `-N hours`/`-N minutes` as `$2`/`$3` parameters. Fix: either inline the interval string (no parameter) using JS template literal, or use `NOW() - ($2::text || ' hours')::INTERVAL` with explicit cast in Postgres.
**Why**: The translate() regex requires the interval to be a literal string in the SQL, not a bound parameter. SQLite accepts `datetime('now', ?)` with a string param; Postgres does not understand `datetime()` at all.
