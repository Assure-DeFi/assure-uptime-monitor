# data-analytics-lead Memory

Persistent memory for the data-analytics-lead agent. Append learnings here.

---

## Observation: Dashboard build requires Supabase env vars at build time
**Discovered**: 2026-03-30
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Valid-Until**: ongoing
**Context**: Attempted `npx next build` during messaging system bug fix verification
**Pattern**: `next build` fails at "Collecting page data" step because API routes import server-side Supabase client which requires `NEXT_PUBLIC_SUPABASE_URL` at build time. Use `tsc --noEmit` for type checking in CI/local when env vars are unavailable.
**Why**: Build verification needs to distinguish between pre-existing infra failures and code-change regressions. TypeScript check is sufficient for code correctness when env vars are missing.

## Pattern: useOutreachMessages select('*') replaced with explicit column list
**Discovered**: 2026-03-30
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Bug 4 fix — reducing payload size for messaging inbox queries
**Pattern**: The `outreach_messages_with_context` view returns all OutreachMessage columns plus lead context columns (lead_id, lead_tier, lead_score, account_type, account_summary, service_fit, project_name, follower_count, profile_picture). Always use explicit column list matching the `OutreachMessageWithContext` type when querying this view.
**Why**: select('*') pulls all columns including any future additions. Explicit list documents the contract and reduces bandwidth.

## Pattern: isLoading flicker prevention with isFirstLoadRef
**Discovered**: 2026-03-30
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Bug 1 fix — polling-triggered loading spinner flicker in messaging inbox
**Pattern**: When a hook polls for data, use `isFirstLoadRef = useRef(true)` and only `setIsLoading(true)` when `isFirstLoadRef.current`. Set false after first successful fetch in the `finally` block.
**Why**: `setIsLoading(true)` on every poll cycle causes UI components guarded by `!isLoading` to flicker (disappear and reappear every poll interval).

## Constraint: force-dynamic on client pages with data queries
**Discovered**: 2026-03-30
**Type**: constraint
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Bug 6 fix — adding force-dynamic to messaging page
**Pattern**: `export const dynamic = 'force-dynamic'` is valid alongside `'use client'` in Next.js page files. The export affects SSR behavior even for client components.
**Why**: Without force-dynamic, Next.js may attempt SSG which fails when Supabase is unavailable (Cloudflare 522).
