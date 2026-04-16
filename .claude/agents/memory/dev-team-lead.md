# dev-team-lead Memory

Persistent memory for the dev-team-lead agent. Append learnings here.

---

(No entries yet — learnings will accumulate across sessions.)

## RLS: Self-Referential Policy Recursion Fix Pattern
**Discovered**: 2026-03-26
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Valid-Until**: ongoing
**Context**: org_memberships RLS policies caused infinite recursion when policies subqueried the same table they protected
**Pattern**: When an RLS policy on table T needs to subquery T itself (e.g., checking admin role), extract the subquery into a SECURITY DEFINER function. SECURITY DEFINER bypasses RLS on the calling user's behalf, breaking the recursion cycle. Always SET search_path = public on SECURITY DEFINER functions. Grant EXECUTE to authenticated only.
**Why**: PostgreSQL evaluates RLS policies on every table access including subqueries within policies. A policy on org_memberships that subqueries org_memberships triggers its own policies, causing infinite recursion. The existing `get_user_org_ids()` SECURITY DEFINER function was already the safe pattern -- 4 admin-check policies were the only ones not using it.

## RLS: Cross-Table org_memberships References Are Safe
**Discovered**: 2026-03-26
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Audited all 64 RLS policies across 30+ tables that reference org_memberships
**Pattern**: Policies on other tables (leads, campaigns, outreach_messages, etc.) that subquery org_memberships are NOT recursive -- they query a different table. Only org_memberships policies that subquery org_memberships are problematic.
**Why**: Prevents over-scoping future RLS fixes. The 64 cross-table policies work correctly and do not need migration to SECURITY DEFINER functions.

## Testing: Proxy-Based Supabase Chain Mock for Vitest
**Domain**: dashboard
**Discovered**: 2026-04-06
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Valid-Until**: ongoing
**Context**: Building billing test suite with 81 scenarios. Initial approach using vi.fn().mockReturnThis() chains failed because Supabase query builder is a thenable, and mock chains can't properly track sequential mockResolvedValueOnce calls across deeply nested method chains.
**Pattern**: Use a Proxy-based mock that implements `then` to resolve to a shared `chainResults` array. Each chain terminal (await) consumes the next result. `let chainResults: unknown[] = []; let chainCallIndex = 0;` — set per test in beforeEach. This handles both `{ data, error }` and `{ count, error }` (head:true) response shapes.
**Why**: Supabase's `.from().select().eq().gte().lte().maybeSingle()` chains are deeply nested. Static vi.fn().mockReturnValue chains break when functions like `checkUsageLimit` make 2 sequential chain queries (subscription + usage). The Proxy approach handles any chain depth and multiple sequential queries cleanly.

## Supabase: PromiseLike Does Not Have .catch()
**Discovered**: 2026-03-30
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Building notification dispatcher for outreach-bot. Supabase `.insert().then().catch()` chain failed TS compilation.
**Pattern**: Supabase query builder returns `PromiseLike`, not `Promise`. It has `.then()` but NOT `.catch()`. Use async IIFE with try/catch instead: `void (async () => { try { const { error } = await supabase...; } catch (err) { ... } })();`
**Why**: TS2339 error at build time. Supabase JS client v2 returns PostgrestFilterBuilder which implements PromiseLike, missing `.catch()`.

## Dashboard: tsc Requires npm install First
**Discovered**: 2026-03-30
**Type**: pattern
**Supersedes**: 2026-03-30 observation of same title
**Invocations-Since**: 0
**References**: 1
**Context**: Build verification for dashboard during notification system build. `npx tsc` resolved to wrong package. Confirmed again in messaging system fixes session.
**Pattern**: Dashboard's `npx tsc` resolves to wrong global package (tsc@2.0.4). Must run `npm install` first, then use `node_modules/.bin/tsc --noEmit` or ensure local typescript is installed.
**Why**: Without local node_modules, npx installs the wrong `tsc` package that is NOT TypeScript.

## Messaging Inbox: outreach_messages Lacks Lead Context Columns
**Discovered**: 2026-03-30
**Type**: decision
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Task 3A audit of lead context join in messaging inbox. OutreachMessageWithContext expects lead_tier, lead_score, account_type etc but outreach_messages only has lead_id FK.
**Pattern**: Created `outreach_messages_with_context` DB view that LEFT JOINs leads and crypto_accounts. Dashboard queries this view instead of raw table. profile_picture comes from crypto_accounts.profile_image_url, not leads.
**Why**: Avoids client-side join logic and keeps the query pattern clean. PostgREST embedded resources would work but require flattening on the client.

## Sidebar Badge: Use Separate Hook File to Avoid Merge Conflicts
**Discovered**: 2026-03-30
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Tasks 1B and 1C both touched use-outreach.ts. Created use-messaging-attention.ts for the badge hook to avoid conflicts.
**Pattern**: When multiple tasks touch the same hook file, create new hooks in separate files rather than adding to the shared file. Especially when different agents/tasks would edit concurrently.
**Why**: Prevents merge conflicts and keeps hook files focused on their concern.

## Views: LEFT JOIN Fan-Out Inflates Counts
**Discovered**: 2026-03-31
**Type**: constraint
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: outreach_messages_with_context view showed 25 rows instead of 23 because crypto_accounts.handle is non-unique (unique key is normalized_handle + handle_platform). Two outreach_messages had leads whose twitter_handle matched 2 crypto_accounts rows each.
**Pattern**: NEVER use a plain LEFT JOIN on crypto_accounts.handle — it is NOT unique and will fan out. Use LATERAL subquery with LIMIT 1, or join on normalized_handle + handle_platform. For count queries, prefer the base table over views with JOINs.
**Why**: Silent count inflation is hard to debug. The 23-vs-25 mismatch between badge (base table) and counter (view) was caused entirely by this JOIN fan-out. Fixed with LATERAL LIMIT 1 in the view and base-table counts in the hook.
