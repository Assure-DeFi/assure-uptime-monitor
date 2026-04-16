# VP Product Memory

Persistent memory for the VP Product agent. Append learnings here.

---

(No entries yet — learnings will accumulate across sessions.)

## Assessment: Full Codebase State Audit
**Discovered**: 2026-03-26
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Read handoff guide and explored full codebase to create agentic team plan
**Pattern**: Five systemic issues: (1) P1-CRITICAL reply sync broken, (2) MT phases 2-7 incomplete, (3) test infra completely broken (typescript not in devDeps, vitest missing, jest+vitest split brain in outreach-bot), (4) 4 files exceed 3000 lines (grok-discovery-route 5211, coordinator 4675, data-provider 3507, pipeline 3226), (5) no CI pipeline running. 67 test files exist but zero can execute.
**Why**: Establishes baseline for all future prioritization decisions. Reply sync is blocking revenue (sales team cannot work from dashboard). Test infra blocks regression detection. MT blocks external revenue.

## Decision: Workstream Merge Order
**Discovered**: 2026-03-26
**Type**: decision
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Created agentic team plan with 6 parallel workstreams
**Pattern**: Merge order: WS1 messaging fix -> WS3 test infra -> WS5 security into WS2 -> WS2 multi-tenant -> WS4 code quality -> WS6 ops (anytime). This order minimizes merge conflicts. WS4 code quality (mega-file splits) MUST wait for WS1 to merge because both touch app.ts and outreach-bot/src/services/.
**Why**: The 3 persistent conflict magnets (pipeline.ts, account-summary.ts, app.ts) make merge order critical. Wrong order = hours of conflict resolution.

## Assessment: Multi-Tenant Deep Dive — What's Built vs What's Missing
**Discovered**: 2026-03-26
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Deep codebase analysis for multi-tenant production readiness plan (49 tasks)
**Pattern**: MT branch has solid Phase 0 foundation (10 tables, RLS, org context, 22 API routes, billing UI, team management). Critical gaps: (1) usage_records never written to — getUsage() reads but nothing increments, (2) plan_limits seed data uses wrong plan names (free/pro/enterprise vs growth/scale/enterprise), (3) lead-enrichment has ZERO org awareness — no organization_id anywhere in that package, (4) outreach proxy doesn't inject x-org-id header, (5) onboarding wizard UI page is missing, (6) outreach routes hardcode Assure org_id as fallback. 16 P0 tasks block launch.
**Why**: Understanding the exact gap between "built" and "production-ready" prevents scope underestimation. The biggest risk is the enrichment worker — it's a completely separate Railway service that processes Redis jobs with no org context. Threading org_id through the queue is the highest-effort plumbing task.

## Constraint: plan_limits Must Match PLANS Constant
**Discovered**: 2026-03-26
**Type**: constraint
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Found DB seeds plan_limits with free/pro/enterprise but code defines growth/scale/enterprise
**Pattern**: plan_limits table rows MUST have plan values matching PlanId type in plans.ts: 'growth', 'scale', 'enterprise'. The old 'free' and 'pro' rows cause null lookups and bypass limit enforcement.
**Why**: This is a silent data mismatch bug — getUsage() returns defaults when plan name doesn't match, making all limits effectively unlimited.

## Decision: Per-Org X Account is P1 Not P0
**Discovered**: 2026-03-26
**Type**: decision
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Evaluating whether X account connection per org blocks MT launch
**Pattern**: Defer per-org X account connection (MT-033, MT-034) to post-initial-launch. First paying customers can use a shared demo mode or have Assure team connect their account manually. The InboxApp multi-account architecture is complex (thread-state-poller filtering, dm-sender credential selection) and risks destabilizing the working outreach pipeline.
**Why**: Launching billing, usage limits, and data isolation is higher leverage than per-org X accounts. First customers likely want the analytics/enrichment value before they need outbound DMs from their own account.

## Decision: Reply Notification System Design
**Discovered**: 2026-03-30
**Type**: decision
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Designed notification system for outreach reply detection -- Telegram + in-app
**Pattern**: Notification dispatch hooks into `handleFirstReply()` in thread-syncer.ts ONLY (not reply-tracker-service.ts). The atomic `.neq('status','replied')` claim provides exactly-once guarantee. Telegram Bot API via simple HTTP POST (no SDK needed). In-app via `notifications` table + Supabase Realtime subscription. Bell icon placeholder already exists in dashboard-header.tsx line 58. Settings page already has notificationsEnabled field.
**Why**: Single hook point avoids double-notification from dual reply detection paths (thread-state-poller + X API webhook). Fire-and-forget dispatch means notification failures never block reply processing. Telegram is free and matches team's existing communication tool.

## Observation: Dashboard Header Has Notification Placeholder
**Discovered**: 2026-03-30
**Type**: observation
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: Analyzed dashboard-header.tsx during notification system design
**Pattern**: Bell icon exists at line 58 of dashboard-header.tsx but is non-functional. Settings page UserSettings interface already defines notificationsEnabled and emailDigestFrequency. These can be extended rather than built from scratch.
**Why**: Reduces Phase 1 implementation effort -- UI scaffolding already exists.
