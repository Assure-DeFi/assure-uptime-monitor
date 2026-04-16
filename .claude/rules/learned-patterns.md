# Learned Patterns - assure-sales-pipeline

Codebase-specific gotchas and recurring patterns. Consolidated 2026-02-24, updated 2026-03-01.

---

## TypeScript Gotchas

- **Set iteration**: Use `Array.from(new Set(arr))` not `[...new Set(arr)]` — config lacks `downlevelIteration`.
- **JSONB casting**: Cast through `unknown` first: `row.field as unknown as MyType`.
- **Closure mutations**: TS can't track `let` mutations in `.then()` callbacks. Use `const x = await doWork().catch(() => null)`.
- **`return await` with finally**: Use `return await fn()` not `return fn()` when function has a finally block.
- **Zod v4 record**: `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`.
- **Zod validation creates clone**: `.safeParse()` returns a NEW object. Validate LAST (after all mutations), not first. Mutating the original after validation is silent data loss.
- **Trim LLM output before Zod**: Always `.trim()` string fields before Zod validation. Whitespace causes `.max()` violations on otherwise valid content.

---

## Next.js / React

- **Dynamic route slugs**: All folders in same path must use same slug name (`[id]` everywhere).
- **SSE deduplication**: Store timestamps/intervals in refs, not state. Strict mode causes multiple connections.
- **Phase/status naming sync**: 6 locations must stay in sync: `progress-store.ts`, 2x SSE route `mapPhase()`, 3x client `PHASE_CONFIG` maps.
- **Status values**: Always `completed`/`failed`, never `success`/`error`.
- **force-dynamic on all data pages**: Every page that queries Supabase needs `export const dynamic = 'force-dynamic'`. Without it, Next.js SSG fails during Supabase outages (Cloudflare 522).
- **Async queue over inline LLM**: Never call LLM APIs inline in a synchronous HTTP route for multiple records. Reset leads to `enrichment_status='pending'` and let the orphan sweep pick them up.

---

## LLM Integration

- **JSON parsing**: Try: markdown json blocks → code blocks → first `{` to last `}` → JSON repair.
- **Temperature**: 0.3-0.4 for structured JSON (95%+ valid), not 0.7 (80%).
- **Thresholds in code, not prompts**: LLMs ignore numeric constraints. Apply in code after raw scores.
- **FORBIDDEN sections**: Explicit `## FORBIDDEN` + runtime filtering with retry.
- **Agent fallback data**: When `success: false` but `data` exists, use it. Only throw if `data` missing.
- **Force critical sources in code**: Don't rely on LLM strategist. Force-include Twitter in `normalizeStrategy()`.
- **Parallel queries**: `Promise.allSettled` (not `Promise.all`). Skip rejected, merge fulfilled.
- **Sanitize input text**: Strip malformed Unicode before LLM prompts.

---

## Supabase / PostgREST

- **Upsert onConflict**: Must match actual unique index column. Leads table: `onConflict: 'twitter_handle'`.
- **JSONB sanitize**: Always `JSON.parse(JSON.stringify(val))` before inserting.
- **Paginate large reads**: `.range(offset, offset + PAGE_SIZE - 1)`, break when `data.length < PAGE_SIZE`. REST caps at 1000 rows silently.
- **NULL handling**: `.lt()`, `.gt()`, `.eq()` do NOT match NULL. Use `.or('column.lt.X,column.is.null')` for nullable columns.
- **Migrations**: Never unbounded UPDATE. Schema in migration, backfill in batches of 1000.
- **Column drops**: Check ALL triggers on that table for references. Trigger function bodies don't auto-update.
- **Migration file ≠ applied**: Having a `.sql` file in repo does NOT guarantee it ran. Verify with `supabase migration list`. Write new migration, don't assume.
- **NULLS FIRST in DESC**: `ORDER BY col DESC` puts NULLs first in Postgres. Add `WHERE col IS NOT NULL` or use `NULLS LAST`.
- **Trigger double-counting**: Before adding code-level cost recording, check for existing DB triggers on same table/column transition. `cost_ledger` has `tr_record_enrichment_cost` on `enrichment_status → 'completed'`.
- **Migration column name drift**: Migration SQL must reference actual current column names. After renames, audit ALL migration files.
- **DB views COALESCE ordering**: When a view JOINs two tables with same column, use COALESCE with correct priority. `leads_full` was pulling NULL from `crypto_accounts` while `leads` had rich Grok summaries — systematic under-scoring (D-tier dropped from 19% to 4.6% after fix).
- **No CASE-based ordering in PostgREST**: `.order()` doesn't support CASE expressions. Fetch `batchSize * 4` rows, sort in JS using tiered comparator.

---

## Railway / Deploy

- **Deploy from parent directory**: `railway up` from `assure-sales-pipeline/` (rootDirectory: outreach-bot).
- **Build config**: Railway uses `tsconfig.build.json`. Verify with `npx tsc -p tsconfig.build.json --noEmit`.
- **Service URL**: `discovery-engine-production.up.railway.app`.
- **API auth**: All endpoints require `x-admin-password` header.
- **NEVER deploy during active runs**: Check `discovery_search_runs WHERE status IN ('searching', 'evaluating', 'setup')`. Each killed run wastes ~$0.80-1.00.
- **Two enrichment services**: Active = `sales-pipeline-enrichment` (project `ce7be8d6`). Deploy via `workspacePath: /home/jeffl/projects/assure-sales-pipeline/lead-enrichment`.
- **Redis queue survives deploys**: Jobs enqueued before deploy retain original parameters. Wait for drain or re-enqueue.
- **Scheduler auto-starts on restart**: Check before manually triggering runs.
- **Cross-package imports fail on Railway**: Never use relative imports across packages. Railway deploys each service from its own root. Copy shared utils into the consuming package.
- **New API call sites must use existing throttle**: When adding functions calling an external API, check for existing rate limiter (e.g., `twitterThrottle`). Route through it.

---

## Discovery Run Management

- **One at a time**: Query `discovery_search_runs WHERE status NOT IN ('completed', 'failed')` before starting.
- **Null intent hangs**: Validate intent before triggering.
- **Early exit paths**: Every early exit must call `updateAfterRun()` with status `failed`.
- **Reconciler timeout**: `worst_case_run_duration × 1.5`. For Grok: 25-30 min.
- **FK constraint**: `discovery_query_id` is FK to `discovery_queries`. Use `campaignId ?? null`, never fall back to `runId`.
- **Vertical rotation**: Diminishing returns within same vertical. Rotate: DeFi → AI → Gaming → Infra → DEX → Meme. Chain rotation also helps.
- **Cost per run**: $0.87-1.50. Cost per new lead: ~$0.005.
- **409 Conflict = run already active**: POST `/api/agentic-discovery/run` returns 409 if a run is in non-terminal state. Find and monitor the active run instead of retrying.
- **DB counters update at completion only**: `total_candidates`, `total_qualified`, `total_ingested` are written once at `completed`. Only `cost` updates during `searching`. Watch cost or Railway logs for live progress.
- **Early-stage query framing**: Use "early community", "grassroots", "actively building" — avoid "sub-5M market cap" (Grok can't evaluate market cap from Twitter). Ingestion rate 14-15% for broad queries, 5% for cap-signal queries.
- **Pool candidates boost repeat runs**: Pool from prior runs is checked free. Run 2 on same theme can have +230% more leads than Run 1. Control for pool when comparing metrics.
- **crypto_accounts dedup gate for discovery**: Grok/swarm re-discovers handles already verified in `crypto_accounts`. Filter these at two points: (1) early swarm ingestion, (2) final handles merge. Filter by `account_status IN ('active', 'inactive')` only — `unknown` stubs fall through (not yet verified). Pool adapter candidates MUST be exempt (captured as `poolNormSet` before merge) because they intentionally originate from crypto_accounts. Fail-open: query errors are non-fatal, proceed without filter. Location: `grok-discovery-route.ts`.
- **Dedup gate with source exemption**: When adding a dedup gate against a backing store, capture the set of handles from any source that intentionally reads from that store BEFORE the gate runs, use it as a bypass list. Mixing source exemptions with the filter in a single pass prevents false-positive exclusions.
- **Diminishing returns check**: If `iteration_N_count < 0.1 * iteration_1_count`, skip remaining iterations. Saves ~$0.80-1.00/run.
- **Strategy planner silent fallback**: When both LLM strategy attempts fail, falls silently to generic deterministic fallback (0% qualification rate). All LLM calls in strategy planner must use `retryWithBackoff` with multi-key rotation.

---

## Data Flow / Endpoints

- **Grok writes to `leads`** via `discovery_query_id` (dual-written to `discovery_campaign_id`), NOT `discovery_run_leads`.
- **Grok run status**: `GET /api/grok-discovery/runs/:runId` — no `/progress` sub-path.
- **Dashboard stats**: Query `discovery_search_runs` directly via Supabase, not backend proxy.
- **Platform scoping**: All lead queries feeding Twitter features need `.eq('handle_platform', 'twitter')`.
- **Discovery API payload**: `/api/agentic-discovery/run` requires `setup.rawQuery`, `setup.entityTypes`, `setup.useCase` (one of: `pitch_audit`, `pitch_marketing`, `partnership_outreach`), `answers[]`.
- **Frontend-to-DB field wiring**: Verify full chain — UI collects → API endpoint accepts → DB insert includes → query response returns. Silent drops at any layer mean data is never persisted.
- **Pool candidates need intent-relevance filtering**: Apply keyword overlap filtering at merge time for pool-only candidates. Cross-source candidates bypass the filter.

---

## Entity Classification

The classification pipeline determines account_type. Canonical logic in `grok-discovery-route.ts`.

**Decision tree**:
1. PROJECT_TOKEN → `'Project/Token'`
2. COMPANY_PLATFORM → `'Company'` (NEVER promoted to P/T without token evidence)
3. Known exchanges (from `crypto_accounts` DB seed) → COMPANY_PLATFORM at 0.99 confidence
4. UNCERTAIN + project signals (bio/tweet/handle) → `'Project/Token'`
5. INDIVIDUAL + confidence >= threshold → `'Individual'` (0.80 if project signals, 0.40 if bio patterns match, 0.60 default)
6. Low confidence (<0.55) → null (not Individual) — forces quality gate to prove identity

**Hard rules**:
- `strongProjectSignals` checks bio ONLY, never tweets — traders tweeting about projects ≠ being a project
- `uncertainHandleMatch` requires bio substance (not just handle regex)
- Entity type gate: `project_token` query accepts ONLY `'Project/Token'`. NULL requires strong project evidence.
- ALL Company entities blocked from project_token queries — no exceptions
- VC/fund handles → Company. Non-crypto bios (numerology, fitness) → Individual.
- Aggregator/tracker handles (signal/radar/monitor suffixes) blocked from all P/T override paths
- 500K+ follower COMPANY_PLATFORM blocked from promotion

**Cashtag ownership** (replaces naive `hasCashtagInBio`):
- `cashtagBelongsToAccount()`: ticker↔handle match, major token = fan, contract address, first-person language, fan context
- `CashtagValidationService`: CMC batch + DexScreener fallback. `cashtagApiMatch='official'` → always P/T; `'fan'` → blocks override
- CMC batch: always `&skip_invalid=true`. Pre-filter symbols to 2-6 char alpha-only.

**Individual detection** (3 layers must agree):
- `INDIVIDUAL_BIO_PATTERNS` mega-regex: web3 job titles (product manager, devrel, growth lead, chapter lead, etc.), first-person patterns ("follow me", "building in public"), role indicators (Ambassador, CM, Trader, Degen)
- `FIRST_PERSON_INDIVIDUAL`: supports `(as|while|where|when) I [verb]` context
- Grok prompts: 15+ web3 roles + "ANY other job title/role" catch-all

**Product bio detection** (`hasProductDescriptionBio()`): 8 regex patterns + feature density. FEATURE_TERMS_RE excludes `chain` (matches "on-chain") and `airdrop` (individual activity).

---

## Activity Gate (MANDATORY Hard Filter)

- **30-day threshold is non-negotiable**: `ACTIVITY_THRESHOLD_DAYS = 30`. NEVER relax or convert to soft signal.
- **3-phase approach**: (1) pre-qualify via discovery tweet date, (2) API check remainder, (3) partition.
- **`tweetCreatedAt` must flow through entire pipeline**: SwarmCandidate → MergedHandleDetail → activity gate.
- **Cache layers must produce outputs**: Phase 1.5 removing handles from `needsApiCheck` must add to `tweetDateMap`. `undefined` = "API failure, don't block" — only for actual API failures.
- **Discovery vs Enrichment double filter**: Discovery uses discovery tweet date. Enrichment fetches fresh tweets. Enrichment is authoritative.
- **`createdAt` is Twitter format, NOT ISO**: `last_tweets` returns `"Tue Feb 24 16:29:33 +0000 2026"`. String comparison fails alphabetically (`'W' > 'T'` makes Nov 2025 appear newer than Feb 2026). Always use `new Date(tweet.createdAt).getTime()` for numeric comparison; return `.toISOString()` for storage. Fixed in both `twitterapi-io-client.ts` and `lead-enrichment/src/providers/twitter.ts`. Also add `pin_tweet` as activity evidence.
- **Retweet fallback required**: Fetch 20 tweets (not 5). Two-pass: prefer `lastOriginalTweetAt`, fall back to `lastAnyActivityAt` (retweet date). Protocol/ecosystem accounts frequently only retweet — retweet = active account.
- **Response path bug**: `twitterapi-io-client.ts` must read `data?.data?.tweets` (not `data?.tweets`). Wrong path returns all nulls → Phase 2.5 writes `last_tweet_at=null` → Phase 1.5 cache reuses nulls as "confirmed inactive" → self-compounding 30-day poisoning. Repair script: `outreach-bot/scripts/repair-activity-cache.ts`.
- **Anomaly detection in `batchGetLastTweetDates`**: If `noTweets/results.size >= 0.9` AND `results.size >= 5`, return empty map. Callers treat `undefined` = API failure = active. Prevents false-inactive poisoning.
- **Bulk archive must use live API**: `enrichment_data.twitter.lastTweetAt` is a point-in-time snapshot never refreshed. Never use for bulk archiving. Use `batchGetLastTweetDates()` fresh.
- **bio_search Apify semaphore**: bio_search and tweet_search share a 6-slot semaphore. Combined ~55 queries at ~20s each can hit timeout. Raised to 360s with graceful resolve. After Apify tier upgrade, raise semaphore from 6 → 30 slots.
- **Multi-tier fallback for bio_search**: Apify tweet-based → Apify legacy watcher → twitterapi.io native. Agent-level timeout via `Promise.race`.

---

## Enrichment Pipeline

- **State machine rule**: EVERY early return must set terminal state on enrichment_run (`enriched` or `failed`). `received` runs are invisible to stale lock recovery.
- **Stale lock recovery**: `.or('lock_expires_at.lt.X,lock_expires_at.is.null')` — NULL locks from pre-lock crashes.
- **Entity type bridge** (pipeline.ts ~line 1865): After Grok account summary, Company/Individual overrides discovery classification. P/T excluded (default fallback).
- **enrichment_data must be dual-written**: Both `buildPipelinePayload()` (leads) and `buildEntityPayload()` (crypto_accounts) need it.
- **Lead-to-run flow**: Discovery → `enqueuePendingLeadsForEnrichment()` → Redis queue → worker → `createRunIfNotExists()`. Orphan sweep: 50 leads/5min for stuck `pending`.
- **`isReEnrichment` flag**: `false` = skip if data exists, `true` = force overwrite. Orphan sweep sets based on `enrichment_completed_at`.
- **Recovery sweeps check for existing usable data**: If lead already has a valid `account_summary`, skip Grok call. Only force `isReEnrichment=true` when data is genuinely missing or stale.
- **Silent phases must emit progress**: Any pipeline phase lasting >30s must emit `reportProgress()` calls with `isCumulative: true`.
- **Throughput**: 8-15 leads/min. New accounts with Grok = ~30-40s each. Existing with summary = ~3-5s each. 718 leads at 8/min ≈ 90 min to drain.

---

## Suppression & Database Clients

- **Supabase REST for real DB access on Railway**: Kysely defaults to SQLite. Use `import { supabase } from '../clients/supabase-client'`.
- **Suppression TTL**: spam/bot = 90d, quality_gate/inactive = 30d. Intent-dependent rejections use `evaluation_memory` (intent-hash scoped).
- **`DB_DRIVER=sqlite` on Railway**: Keep it. Suppression no longer needs Kysely. `DB_DRIVER=pg` causes ENETUNREACH.

---

## crypto_accounts Architecture

**Core principles (non-negotiable):**
1. **Never lose enriched data** — All entity data persists permanently on `crypto_accounts`.
2. **Database-first discovery** — Query `crypto_accounts` FIRST before hitting external APIs.
3. **Entity vs query data separation** — Entity data → `crypto_accounts`. Query fit → `leads`.
4. **Two scores** — Entity score (universal, on crypto_accounts) and intent score (per-query, on leads). Priority = entity_score × (intent_score / 100).
5. **crypto_accounts is the product** — Phase 1: internal tool. Phase 2: multi-tenant SaaS. Phase 3: universal crypto API.
6. **Chain constraints optional** — Null/empty/["all"] = accept all chains.
7. **Heuristic intent matching removed** — `passesIntentQuickCheck()` kept for analytics only.

**Filtered candidates**: All persisted via `buildCryptoAccountUpsert`. `source_data->>'filterReason'` stores rejection reason.

**account_status invariants** (post migration `unify_account_status_from_tweet_date`):
- `'active'` = `last_tweet_at IS NOT NULL` AND within 30 days
- `'inactive'` = checked + tweet older than 30 days, OR checked + no tweets found
- `'unknown'` = NEVER been activity-checked — `last_tweet_at` is always NULL
- `null` status = ELIMINATED (all normalized to 'unknown')
- DB trigger `tr_sync_account_status`: Any INSERT/UPDATE of `last_tweet_at` with non-null value auto-sets `account_status`. "Needs checking" query: `account_status = 'unknown'`.

**Schema differences from leads** (JOIN gotchas):
- `crypto_accounts.handle` (NOT `twitter_handle`) — join on `ca.handle = l.twitter_handle`
- `crypto_accounts.followers` (NOT `follower_count`)
- `filter_reason` is inside `source_data` JSONB, NOT a top-level column
- `discovery_queries` has NO `playbook_id` column — playbook_id goes on `leads` rows directly
- `leads_full` view exposes `symbol` (NOT `token_symbol`) — use `symbol` in scripts querying the view

---

## DM Quality

**M1 Reply-First Mandate**: First DM is 100% about the prospect. Zero pitch, zero company mention. Goal: get a reply. Services enter in M2/M3 only.

**Quality gate** (`dm-quality-gate.ts`):
- `sanitizeDm()`: 3-phase post-processing — word rewrites (AI-tell removal), sentence deletion (audit/security/self-promo), cleanup
- `FUD_PATTERNS`: Named exploit list (26 protocols). Add new hacks as they occur.
- 3 variants per lead: 2 data-driven + 1 disruptor. Target 100-250 chars, max 280. **No sub-140 requirement** (removed 2026-02-27).
- `truncateToSub140()` and `_short` variant injection are DELETED. Do not re-add.
- LENGTH_LIMITS: uniform `{ min: 80, max: 280 }` across all richness levels.
- DM column: `dm_variants` (NOT `m1_dm_variants`). Prompt: `lead-enrichment/src/llm/prompt.ts`.
- `dm_variants` storage format: JSON array of objects (NOT dict). Each: `{angle: string, text: string, char_count: number}`.

**Reply hook mandate**: `tech` and `momentum` angles MUST end with a question the prospect can only answer about their own project. `conversation_starter` MUST include a reply hook. Flat statement = auto-failure. Detection: if ALL `dm_variants` for a lead lack '?', the lead has dead-end DMs. Fix script: `lead-enrichment/scripts/fix-dead-end-dms.ts`.

**Surgical DM repair** (without Grok re-call): Fetch enrichment_data from DB, call `qualifyLead(accountIntel, accountClassification, twitterData, angles)` directly, PATCH only `dm_variants`. JSONB-stored `AccountIntel` arrays may be `null` in DB — normalize to `[]` first (see `normalizeAccountIntel()`). Grok = ~$0.05-0.10/lead; DM gen via OpenRouter is cheap.

**Continuous audit loop**: `continuous-audit.ts` polls every 60s for new completed leads since watermark. When count >= 200: run full audit + cleanup (wrong account_type, DISQUALIFY-with-DMs, no-x-user-id, zero-variant leads), advance watermark.

**AI-tell corpus auditing**: `genuinely` was 4.9% of 954 variants (added to `DM_REWRITES`). Audit quarterly for new adverb clusters. Candidates: 'clearly', 'truly', 'really', 'certainly'.

**DQ calibration**: Keyword gates (e.g., "compliance", "audit") must scope to self-promotional usage only, not prospect context. Medium scam risk, impersonator reports, speculative language should NOT trigger DQ. Only confirmed scam/rug evidence warrants DQ.

---

## Symbol Pipeline

- **Trusted sources only**: `discoverSymbol()` → DEX pair → CoinGecko → CMC. `extractedTickers` and `project_name` inference DISABLED.
- **Format validation**: 2-12 chars, alpha-only, reject dots/spaces/special.
- **Major token protection**: BTC/ETH/SOL/BNB rejected from tweet/pinned sources.
- **Multi-ticker guard**: 3+ distinct $TICKERs → drop `tweet_ticker` (aggregator signal).
- **DexScreener**: Per-pair `info.socials` twitter URL resolves ownership better than top-level search.

---

## Scoring System

- **Single score**: `lead_score` (0-100) + `lead_tier` (S/A/B/C/D) on leads table.
- **Components**: Account Health (30%), Project Strength (45%), Sales Signals (25%). Confidence multiplier (0.5x-1.0x).
- **Module**: `lead-enrichment/src/scoring/` — pure functions, no DB access.
- **Batch recalc**: `lead-enrichment/scripts/recalculate-scores.ts [--dry-run]`.
- **Playbooks + dual scoring**: Playbooks replaced funnels. `scoring_profile` JSONB defines target entity types, size preference, category matches. Scoring = entity score (30%) + intent score (70%). DB: `playbooks` table with 4 rows (security, trust_marketing, partnership, kill_switch).

---

## Cost Tracking

- **`cost_ledger`** = single source of truth (append-only). Three auto-insert triggers.
- **Grok writes costs to `discovery_search_runs`**, not `discovery_runs`.
- **x_search**: $0.005 per invocation (3-10 per request). NEVER enable on non-search calls.
- **All 3 API keys share team credits**: When one hits limit, ALL exhausted.
- **cost_ledger_type enum**: New cost categories require migration: `ALTER TYPE cost_ledger_type ADD VALUE IF NOT EXISTS 'outreach_dm';`

---

## Registration Checklists

**New DataSource (5+4 locations)**:
- Code: `types/candidates.ts`, `tools/adapters/{name}.ts`, `tools/adapters/index.ts`, `data-sources/index.ts`, `tools/registry.ts` ALL_TOOLS.
- Health: `agent-health-service.ts` SOURCE_TIER_MAP, `api-health-monitor.ts` API_PROBES + data integrity, `agent-health-dashboard.tsx` ACTIVE_SOURCES + SOURCE_DESCRIPTIONS + DORMANT_ADAPTERS.

**New Agent (3+2 locations)**:
- Code: `types/agents.ts`, `index.ts` AGENT_COST_ESTIMATES, `utils/llm-client.ts` AGENT_PROVIDER_MAP.
- Health: `agent-health-service.ts` AGENT_TIER_MAP, `agent-health-dashboard.tsx` ArchitectureOverview.

**Playbook quality overrides (4 locations must stay in sync)**:
1. `outreach-bot/src/playbooks/definitions/{name}.ts` → `qualityGate` field (source of truth)
2. `lead-enrichment/src/core/playbook-overrides.ts` → `PLAYBOOK_QUALITY_OVERRIDES` map
3. `lead-enrichment/src/worker.ts` → playbook loading block (~line 248)
4. `lead-enrichment/src/core/pipeline.ts` → 7 `validateDmQuality()` call sites (all receive `playbookOverrides`)

---

## Evaluation & Scripts

- **Pipeline evaluation**: `lead-enrichment/scripts/evaluate-pipeline.ts` — 10 categories, A-F grades, `--compare` for deltas.
- **Batch re-enrichment**: `lead-enrichment/scripts/batch-reenrich.ts --count N [--dry-run]`.
- **Lead quality pipeline**: reclassify → reenrich → recalculate-scores (run in order).
- **Baseline**: Read old baseline BEFORE saving new `.eval-baseline.json`.

---

## Screenshots (WSL)

- **Script**: `node scripts/screenshot.js [path] [output]` from project root.
- **Production URL**: `sales-pipeline-dashboard.vercel.app`
- **Auth**: Supabase cookie auth via magic link OTP for `tom@assuredefi.com`. Cookie: `sb-svauukzvqkmefpxmqmsn-auth-token`.

---

## twitterapi.io

- **Response wrapper**: `getUser()` returns `{ data: { userName, followers, ... } }`. Access via `response.data.userName`.
- **Following endpoint**: `/user/followings` (trailing 's').
- **Batch lookup**: `GET /user/batch_info_by_ids?userIds=id1,id2` (GET, not POST).
- **Two clients**: `twitterapi-io-client.ts` (class, enrichment) and `twitter-api-client.ts` (functional, swarm).
- **`createdAt` is Twitter format, not ISO**: See Activity Gate section.

---

## General Principles

- **Cache bypass rule**: When a cache layer shortcuts a pipeline stage, it must produce the SAME outputs the skipped stage would have produced.
- **Split-write audit**: When splitting a write into two targets, verify BOTH get all required fields.
- **Threshold gaps**: When two thresholds define a range, verify there's no gap between them.
- **Merge conflict verification**: After resolving conflicts, verify functions still exist with grep.
- **retryWithBackoff**: Positional args `(fn, retries, baseDelayMs)`, NOT options object.
- **Backfill scripts JOIN against FK targets**: Backfill UPDATE statements referencing FK columns must JOIN against the target table. Parent records may have been deleted.

---

## Dashboard / Metrics

- **Ingested vs discovered counts**: Show `totalIngested` (qualified leads added to pipeline), not `totalCandidates` (raw discovered handles).
- **PostgREST 1000-row pagination**: Dashboard aggregate queries must paginate with `fetchAllRows()` pattern when total rows may exceed 1000.

---

## Outreach Pipeline

- **leads vs leads_full view**: `bio` and `chain` live on `crypto_accounts`, NOT `leads`. Use `leads_full` or extract from `enrichment_data.twitter.description`. `telegram` is on `crypto_accounts` (not `tg_url`).
- **X API 403 = immediate fail, no retry**: DMs locked to followers-only = deterministic. Detect via `failureReason.includes('403') && failureReason.includes('permission')`.
- **429 = full rate window backoff (15 min)**: Set `rateLimitUntil` timestamp. Skip poll entirely if still within window.
- **Sequence permanent failure → advance to next contact, not cancel**: When any contact fails permanently (403 OR ≥2 attempts), advance to the next contact in the sequence group — do NOT cancel the whole group. Different contacts in the same sequence group are different handles with different DM settings; one failure doesn't predict others. `cancelSequenceGroup()` only fires inside `advanceSequenceToNextContact()` when there are NO remaining queued contacts. Location: `dm-queue-worker.ts`.
- **Sequence reschedule on contact advance**: When advancing past a failed contact, update ALL remaining queued contacts — first gets `scheduled_send_at = now`, subsequent get `now+2d`, `now+4d`, etc. Only bumping the next one leaves downstream contacts with stale timestamps that may be in the past.
- **canDm gate**: Checked once at lead ingest (`coordinator/context.ts`). `canDm=false` → never enriched, never queued. `canDm=undefined` → benefit of doubt. JIT pre-flight at send time is NOT needed.

---

## Reply Detection

- **X Account Activity API webhook is broken** (since Jan 2026): Does NOT fire `dm_events` for new Chat UI (x.com/i/chat). Unusable for reply detection.
- **Use InboxApp webhook** (zero cost, read-only): Sees ALL DMs regardless of send method. $199/mo plan only required for InboxApp OUTBOUND sending — webhook available on any plan. Route: `/api/inboxapp/webhook`. Signature: `X-Inbox-Signature: t=<timestamp>,v1=<hmac_hex>`. Events: `message.created`, `target.replied`, `target.contacted`, `target.followUpSent`, `prospect.statusChanged`, `thread.assigned`. Outbound detection: `data.authorId === data.accountLink?.id`.

---

## Messaging Inbox Schema

- **`dm_conversation_events` table**: columns are `id`, `outreach_message_id`, `dm_conversation_id`, `dm_event_id`, `sender_id`, `sender_handle`, `direction`, `message_text`, `event_timestamp`, `created_at`. **NO `event_type` column** — use `direction` ('inbound'/'outbound'). Inserts with `event_type` fail silently.
- **Two rendering paths in `messaging-inbox.tsx`**: `events.length === 0` → fallback view (reply_text from outreach_messages). `events.length > 0` → ConversationBubble per event. If inbound INSERT fails, reply won't show even if stored in `outreach_messages.reply_text`.
- **`dm_suggested_responses.angle` constraint**: Must cover all 7 values: `pain_probe`, `social_proof`, `urgency`, `reframe`, `differentiation`, `value_proposition`, `identity_bridge`. Narrower constraint silently blocks all suggestion inserts. Migration: `20260227_fix_dm_suggested_responses_angle_constraint.sql`.

---

## Mining Pipeline

**Key rules**:
- Use `.eq('account_status', 'active')` NOT `.neq('account_status', 'inactive')`. `!= inactive` includes `unknown` accounts.
- Run `batch-activity-check.ts --unknown-only` before mining to resolve unknown pool. `--delete-unknown` deletes accounts still unknown after sweep (with >90% null rate anomaly guard).
- Paginate with `.range(offset, offset + PAGE_SIZE - 1)` loop — PostgREST silently caps at 1000 rows.
- Always set `campaign_id` directly in insert rows — `auto_assign_campaign_trigger` fires on INSERT when `campaign_id IS NULL`, grabbing all leads into first NULL-qualification-logic campaign. Mining campaign ID: `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (priority=0).
- Handle dedup requires `normalized_handle`: `crypto_accounts.handle` is lowercase; `leads.twitter_handle` is mixed case. Query `leads.normalized_handle IN (chunk)`.

**Intent gate for mining** (CRITICAL — HARD DELETE risk):
- Mining queries have `use_case=null` and `raw_query="Mining from crypto_accounts inventory"`.
- Empty string `useCase` is truthy → passed to Grok → Grok reads "Mining" as Bitcoin mining → scores all DeFi/DePIN as `intentMatch=false` → hard-delete the lead.
- Fix: only set `queryIntent` when `use_case` is non-null and non-empty. Guard: `hasRealIntent = !!(discoveryCtx?.queryIntent?.useCase?.trim())`.
- Symptom: `completed_no_lead` with `account_status=active`, logs mentioning "crypto mining" for DeFi projects.

**Hard filters in `mine-crypto-accounts.ts`** (do not remove):
- `CEX_TAGS`: `centralized-exchange`, `cex`, `centralized_exchange` — no smart contract surface
- `MEME_CMC_TAGS`: `memes`, `animal-memes`, `cat-themed`, `mineable` — CMC-confirmed meme/PoW coins
- `NFT_COLLECTION_HANDLE_PATTERNS`: `_nft`, `_nfts`, `_holders`, `nft_`
- `MEME_HANDLE_WORDS`: `inu`, `pepe`, `doge`, `shib`, etc.
- Individual entity type filter after entity type bridge
- Pump-fun-only without substantive tech tags (defi/ai/infra/l1/l2/depin/rwa/gaming)
- Note: `inactive` tag on mining leads is a stale discovery artifact — do NOT use as quality filter.

**Quality benchmarks** (6-batch, 582-lead audit):
- S/A tier rate: 76% (vs ~40-50% for agentic discovery). Mining is higher quality.
- Non-CMC accounts outscore CMC-listed by +3.7 pts avg. DB-native confidence DESC ordering is better than CMC-first.
- Cost: $0.216/DM-ready lead. CMC Hobbyist 30 RPM is #1 throughput bottleneck.
- Meme intent penalty: `-20` on intent score when Grok summary mentions "meme coin/token/project" (`intent-score.ts`).

**enrichment_status values**: `completed`/`completed_partial` (NOT `enriched`/`enriched_partial`). `outreach_state` enum: `new`, `messaged`, `replied` (NOT `pending`/`sent`/`responded`).

---

## Lead Quality: Early Stage Security Playbook

**High-risk ≠ disqualified** — This playbook targets clients that ARE high-risk by crypto-native standards.

Valid disqualify reasons ONLY:
1. Not a crypto project at all (web2 company, personal lifestyle account)
2. Definitively and permanently shut down — official announcement + zero activity 90+ days
3. Confirmed exit scam — founders arrested/fled WITH user funds AND project has zero presence

**NOT disqualifying**: Anonymous team, had exploits (= better prospect!), CEO controversy, investor disputes, lawsuits, meme coin status, regulatory scrutiny, low market cap, product pauses.

**Disqualified leads still pass through to outreach**: `disqualified: true` in enrichment_data does NOT gate DM generation or enrichment_status. Manual deletion + suppression required for confirmed non-crypto/defunct accounts.

---

## Production Readiness Notes (2026-02-25)

- **Grok API**: Use `grok-4` family. `grok-3` deprecated for server-side tools. `grok-4-1-fast-reasoning` is the correct default.
- **Grok XML citation artifacts**: Grok LLM responses can contain `<grok:render>` XML tags (citation/source rendering artifacts). These corrupt structured JSON parsing and string field values. Strip before any parsing: `text.replace(/<grok:render[^>]*>[\s\S]*?<\/grok:render>/g, '').replace(/<\/?grok:[^>]*>/g, '').replace(/\s{2,}/g, ' ').trim()`. Location: `stripGrokArtifacts()` in `lead-enrichment/src/enrichment/account-summary.ts`.
- **Entity type bridge writeback gap**: Enrichment writes correct entity type to `enrichment_data.accountClassification.accountType` but does NOT propagate back to `leads.account_type` automatically.
- **Empty enrichment_data payloads**: Silent failure path sets terminal status without writing data. Results in `enrichment_status=completed` but `enrichment_data={}`.
- **Weak symbol validation**: When `symbolValidation.status === "weak"` and confidence is 0, token_symbol should be null, not the weak symbol.
- **Discovery run stuck state**: When both Grok and swarm fail silently, `Promise.all` resolves with nulls and run stays in `searching`. 3-layer defense: (1) pure failure detection, (2) finally block safety net, (3) reconciler parent query update.
- **SocialFi vertical saturation**: SocialFi produced only 868 candidates vs 1,636-1,995 for other verticals (74% pre-existing overlap). Consider deprioritizing.
- **LLM swarm audits over-report severity**: 5/8 "systemic risks" in V2 swarm were false positives. Always verify before implementing fixes.

---

## InboxApp Conversation Sync

**REST API thread shape differs from webhook payload shape (critical)**:
- REST `/threads/lookup-by-username` returns `thread.accountLinkId` (flat top-level string), NOT `thread.accountLink.id` (nested object)
- REST prospect has `prospect.platformId` (numeric string), NOT `prospect.id`
- Webhook events use `data.accountLink.id` and `data.prospect.id`
- Always use: `senderAccountId = thread.accountLinkId ?? thread.accountLink?.id`
- Always use: `prospectId = thread.prospect?.platformId ?? thread.prospect?.id`
- Using wrong field → `senderAccountId = undefined` → `sender_id NOT NULL` violation on every insert

**Bulk sync via local machine when Railway is rate-limited**:
- InboxApp rate limit: 300 req/min, separate bucket per IP
- Railway IP can exhaust independently of local machine with same token
- Local bypass script: `node /tmp/sync-conversations-local.js` (or recreate from `outreach-bot/src/services/inboxapp-conversation-sync.ts` logic)
- Use `POST /table?on_conflict=dm_event_id` with `Prefer: resolution=merge-duplicates` for upsert that fixes bad directions from previous failed syncs

**Two Railway services both need deployment after outreach code changes**:
- `discovery-engine-production.up.railway.app` → dashboard API (`OUTREACH_BOT_URL`) → deploy from monorepo root
- `outreach-bot-production.up.railway.app` → Hookdeck webhook handler → deploy from `outreach-bot/`
- Missing either deploy = partial functionality (webhook works, dashboard sync broken, or vice versa)

**dm_conversation_events NOT NULL columns**: `outreach_message_id`, `dm_conversation_id`, `sender_id`, `direction`, `message_text`, `event_timestamp`. The `sender_id` is the most common accidental null.

**Capture outbound `message.created` from X native UI (don't drop)**: InboxApp fires `message.created` even when the DM was sent directly from X (not via our queue). Old behavior: drop when `authorId === accountLink.id`. Correct: route to `handleOutboundMessageCreated()` — look up the latest `sent`/`replied` outreach_message for the prospect, insert as `direction='outbound'`, update denormalized stats. Prospect handle in webhook outbound events: `data.prospect?.username` (lowercase, NOT `.userName` or `.handle`).

**Synthetic M1 dedup guard**: In `syncConversationViaInboxApp`, track `hasOutboundFromInboxApp` during the loop. Only insert synthetic M1 (`id='m1-{messageId}'`) if `hasOutboundFromInboxApp === false`. Without this guard, re-syncing after InboxApp captures the real outbound event creates a duplicate M1 bubble in the dashboard.

**Re-sync on every inbound reply (not just first)**: `syncConversationViaInboxApp(outreachMsg.id)` must fire on every inbound reply, not gated by `isFirstReply`. Reason: manually-sent follow-up DMs from X between prospect replies are only captured via re-sync, never via the initial first-reply sync.

**Pre-flight sibling reply check in dm-queue-worker**: Before sending any queued DM, query `outreach_messages WHERE sequence_group_id=X AND status='replied' AND id != this_id LIMIT 1`. If found → cancel with `failure_reason = "Pre-flight: {handle} already replied in sequence group"`. Safety net for webhook delivery failures where `cancelSequenceSiblings` didn't propagate. Cost: 1 DB query per attempted send.

**Thread-state polling replaces event cursor (2026-03-03)**: InboxApp events poller (cursor in Redis) replaced by `thread-state-poller.ts`. Architecture: poll full thread state from InboxApp, reconcile against DB. Self-healing on restart — no cursor to lose. Recovery window = InboxApp thread history (no expiry). Tiered polling: hot (<24h) = every cycle (~90s), warm (1-7d) = every 5th cycle (~7.5min), cold (7-30d) = every 20th cycle (~30min). Cost = ~27 req/min peak = 9% of 300 req/min limit. Key lesson: DB-as-state is always more resilient than cursor-in-cache.

**dm_thread_links table**: Permanent cache mapping InboxApp thread IDs → `outreach_message_id`. Schema: `id, inboxapp_thread_id, outreach_message_id, prospect_handle, our_account_id, prospect_platform_id, created_at, last_synced_at, last_message_at`. Created via migration `20260304_add_dm_thread_links.sql`. `linkThread()` called 30s after successful M1 send (to allow InboxApp thread creation time). `getUnlinkedMessages()` sweeps for orphaned sent messages on each poll cycle.

**enrichment_data JSONB field shapes (canonical)**:
- `accountIntel` is an **object** (NOT array): `{ oneLiner, projectStage, techStack[], outreachAngles[], urgencySignals[], tractionSignals[], recentAnnouncements[], potentialNeeds[] }`
- `token` uses `ticker` (NOT `symbol`) and `primaryBlockchain` (NOT `launchStatus`)
- `twitter.recentTopics` does NOT exist — use `recentAnnouncements` from accountIntel
- Top-level `categories` field does NOT exist — use `accountIntel.techStack`
- These are stable shapes; using wrong field names silently returns `undefined`, causing empty prompts

**recipient_handle must be lowercase everywhere**: Store as lowercase on INSERT (dm-sender-service + queue-leads-for-outreach). All lookups must use `.ilike()` for case-insensitive matching. Mixed case causes missed handle matches in reply detection. Migration `20260303_lowercase_recipient_handles.sql` backfilled existing rows.

**M2 DM identity rule**: `@el_crypto_chapo` or `Chapo` MUST appear in first 60 chars. Hard-fail on "from Assure DeFi" in first 80 chars — it's redundant since the DM is already sent from @assuredefi account. Rule enforced in `m2m3-quality-gate.ts` Rule 11.

**`ignoreDuplicates` on thread-linker upsert (re-contact safety)**: `linkThread()` must use `{ onConflict: 'inboxapp_thread_id', ignoreDuplicates: true }`. Without it, re-contacting a prospect (second campaign) clobbers the original `outreach_message_id`, causing the first conversation to become orphaned. First link wins — never overwrite.

**PostgREST 1000-row cap on intermediate lookups**: `getUnlinkedMessages()` fetches all linked IDs from `dm_thread_links` to build an exclusion set. This intermediate query also hits the 1000-row silent cap. Add `.limit(5000)` (or paginate). Without it, IDs beyond row 1000 are treated as "unlinked" and re-processed.

**Re-entrancy guard on polling loops**: Long-running poll cycles (e.g., `thread-state-poller`) can overlap when the cycle duration exceeds the interval (90s). Use a module-level `pollRunning` boolean: set `true` at entry, clear in `finally`. If true at entry, log a warning and return immediately. Without this, concurrent cycles double-process events and create duplicate DB entries.

**Atomic first-reply claim with `.neq()` guard**: `handleFirstReply()` can be called concurrently by multiple poller cycles for the same message. Use `.neq('status','replied')` on the UPDATE and check returned `count`. If `count === 0`, another call already claimed the first reply — skip all side effects (suggestions, stats, notifications). Prevents double-firing one-time actions.

**JIT-regenerated DM text must be written back to DB**: In `dm-queue-worker`, when freshness check triggers DM regeneration, the new `message.message_text` is used for sending but was NOT persisted. Fix: include `message_text` in the sent-status update payload with `...(jitRegenerated ? { message_text: message.message_text } : {})`. Without this, the DB shows stale text while the actual DM sent differs.

**Upsert composite conflict key when `dm_event_id` is null**: `reply-tracker-service` uses `onConflict: 'dm_event_id'` when event has a real ID. For synthetic/historical events with `dm_event_id = null`, use composite key `(outreach_message_id, event_timestamp, direction)`. Requires a unique index on those three columns. Without it, null events always insert (null ≠ null in unique indexes), creating duplicates.

**Multi-account InboxApp: filter threads by `INBOXAPP_DEFAULT_ACCOUNT_LINK_ID`**: When a prospect has threads with multiple InboxApp account links, `threads[0]` may return the wrong account's thread. Filter: `threads.find(t => (t.accountLinkId ?? t.accountLink?.id) === defaultAccountLinkId) ?? threads[0]`. Required when running multiple X accounts through InboxApp.

**Merge conflict resolution commits may silently omit files (THREE-PEAT)**: A commit titled "resolve merge conflicts" can be a lie if files weren't staged. `git show` reveals the truth — check the `N files changed` line. Three files in this repo are persistent conflict magnets: `pipeline.ts`, `account-summary.ts`, `app.ts`. This failure has recurred in 2026-03-05, 2026-03-06, AND 2026-03-07 compounds — each claimed resolution but `git show` showed only learned-patterns.md changed. **HARD GATE (not advisory)**: After ANY conflict resolution, you MUST (1) run `grep -rn "<<<<<<" lead-enrichment/src outreach-bot/src`, (2) confirm zero results, (3) `git add` the specific resolved files, (4) verify with `git diff --cached --name-only` that they appear in staged changes. If grep returns ANY results, resolution is INCOMPLETE — do not commit. Resolutions: `pipeline.ts` = keep upstream (DB trigger handles cost), `account-summary.ts` = keep upstream (formatting), `app.ts` = keep `inboxAppWebhookRouter` import (used at line 50).

**docs/account-data-dictionary.md**: Comprehensive reference for every field in `leads` and `crypto_accounts` — source, purpose, and current usage. Check this before adding/renaming columns or when unsure which field name a service uses.

---

## Autoresearch: Entity Classification Tuning

- **Location**: `autoresearch/` — frozen evaluation dataset + experiment loop for tuning heuristic entity classifier against LLM ground truth.
- **Evaluate**: `npx tsx autoresearch/evaluate.ts` — primary metric: `weighted_f1` (grep-friendly output).
- **Frozen dataset**: `autoresearch/datasets/entity-classification.json` — 1900 accounts with LLM-established ground truth. NEVER modify.
- **Fresh benchmark datasets**: 9 additional datasets (`fresh-benchmark.json` through `fresh-benchmark-9.json`, 208-350 accounts each). Total: 10 datasets, 4531 accounts.
- **Tunable files**: `outreach-bot/src/prequal/full-pipeline-classifier.ts` (override gates), `deterministic-classifier.ts` (core logic), `lookup-tables.ts` (regex patterns).
- **Current accuracy (2026-03-11)**: Training set (ds 1-6) 100%. Fresh benchmarks (ds 7-9) 95.3-99.4%. Overall **99.45%** (4506/4531). Branch: `autoresearch/entity-classification`.
- **Fresh-9 dataset**: 350 accounts built via OpenRouter/Gemini Flash 2.0 (direct Gemini API quota-exhausted, 429s). Script: `/tmp/build-fresh-9e.cjs`. Fetches novel accounts from Supabase REST API, classifies via OpenRouter.
- **Experiment protocol**: One change per commit, evaluate, keep if weighted_f1 improves, `git reset HEAD~1 --hard` if not. Record all results in `results.tsv`.
- **Build dataset**: `node autoresearch/scripts/build-frozen-dataset.cjs` — regenerates from current `crypto_accounts` data.
- **Rule testing methodology**: Pattern-match against ALL accounts, count +fixes (pattern matches AND gt===target AND pred!==target) vs -regressions (pattern matches AND gt!==target AND pred!==target). Only implement CLEAN rules (0 regressions).
- **Overfitting is real even with rules**: Training set reached 99.97% but fresh-7 showed 59.0% initially. After 5 rounds of generalizable rules, improved to 95.3%. Handle-specific or account-specific overrides overfit. Prefer broad pattern classes.
- **Company detection is the hardest class**: On fresh data, Company has worst f1. Root cause: `handleIsStrongProjectPattern=true` for handles like `_Protocol`, `_Finance`, `_Wallet`, `_dex` routes to P/T, but LLM considers many infrastructure/service providers to be Companies.
- **LLM ground truth contains errors**: ~3-5% of LLM-classified ground truth labels are wrong (pizza restaurants as Company, esports players as P/T, non-crypto accounts mislabeled). Always audit error accounts for GT quality before adding rules. Fix GT errors in the dataset — they're data quality corrections, not overfitting.
- **Systematic rule testing with t() function**: Pattern-match against ALL datasets simultaneously. `t(name, predicate, target)` counts +fixes and -regressions. Only implement CLEAN rules (0 regressions). Write test scripts in `/tmp/test-fresh9-rN.ts`.
- **bio_substance_gate blocks short-bio DeFi protocols**: Accounts with defillama+seeded tags but very short bios (< 40 chars like "Coming back soon") get blocked by bio_substance_gate. Override with tag evidence + DeFi category tags.
- **JSON bio corruption**: ~11% of fresh-7 accounts have raw Grok LLM output as bio (starts with `{`, contains `"entityType"`). These are pipeline data quality issues, not classifier problems. Can't fix with heuristic rules without massive regressions (66+ false matches).
- **Ternary chain rule placement is critical**: First match wins. Rules placed after the P/T catchall (line ~1109) or after `handleIsStrongProjectPattern` catch-all (line ~881) won't fire for accounts caught by those catch-alls. PT-guarded rules must go BEFORE those lines.
- **`\w` doesn't match CJK/katakana in JS regex**: Use `\S` (any non-whitespace) instead of `\w` when next character might be non-ASCII.
- **Curly apostrophe U+2019 != straight apostrophe U+0027**: Character classes like `['']` may visually look like they include both, but check hex bytes with `xxd`. Use `\u2019` explicitly.
- **Batch commits for classifier tuning**: After individual experiments stabilize, batch related changes into single commits with clear metrics in commit message.

---

## Compound Branch: Merge to Main Promptly

- **Anti-pattern**: Long-lived `work/compound-learnings-*` branches accumulate merge conflicts on every rebase/merge. The same 3 files (`pipeline.ts`, `account-summary.ts`, `app.ts`) conflict every session.
- **Fix**: After compounding learnings, merge the branch to main (or commit directly to main) and delete the branch. Compound commits are low-risk `chore:` changes to `.claude/rules/` — they don't need feature branch isolation.
- **If on a stale compound branch**: Resolve conflicts per the documented resolutions (see "Merge conflict resolution commits" above), then merge to main immediately.
