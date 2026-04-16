# Agent Memory Index

Cross-agent topic index. Check relevant topics before starting work.
Last updated: 2026-03-24

---

## GLOBAL CONSTRAINTS (Apply to ALL agents, every session)

### No Secrets in Code or Memory Files
**Type**: constraint
**Pattern**: NEVER write API keys, tokens, passwords, JWTs, or connection strings into ANY file. Always use environment variable references.
**Why**: Secrets committed to git persist in history even after deletion.

### Dedup Before Writing Memory
**Type**: constraint
**Pattern**: Before appending a new entry to your memory file, search for existing entries with the same title or highly similar Pattern text. If found, UPDATE the existing entry instead of creating a new one.
**Why**: Duplicate entries waste context window tokens.

### No Cross-Package Imports
**Type**: constraint
**Pattern**: NEVER import between outreach-bot, lead-enrichment, and dashboard packages using relative paths. Copy shared utils into the consuming package.
**Why**: Railway deploys each service from its own root. Cross-package imports cause build failures in production.

### PostgREST 1000-Row Cap
**Type**: constraint
**Pattern**: ALL Supabase queries that could return more than 1000 rows MUST paginate with `.range(offset, offset + PAGE_SIZE - 1)`. Break when `data.length < PAGE_SIZE`.
**Why**: PostgREST silently caps at 1000 rows. Unpaginated queries return incomplete data with no error.

### Activity Gate is Non-Negotiable
**Type**: constraint
**Pattern**: `ACTIVITY_THRESHOLD_DAYS = 30`. NEVER relax the 30-day activity threshold or convert it to a soft signal. Always use `new Date(tweet.createdAt).getTime()` for date comparison (Twitter dates are NOT ISO format).
**Why**: Inactive accounts waste enrichment budget and produce zero ROI on outreach.

### No Deploys During Active Runs
**Type**: constraint
**Pattern**: Before any Railway deployment, check `discovery_search_runs WHERE status IN ('searching', 'evaluating', 'setup')`. Each killed run wastes ~$0.80-1.00.
**Why**: Deploys restart services and kill in-progress discovery/enrichment runs.

### Terminal States on All Exit Paths
**Type**: constraint
**Pattern**: Every early return in pipeline code (enrichment, discovery, outreach) MUST set a terminal state (`completed`/`failed`). Never leave a record in a non-terminal state.
**Why**: Non-terminal records become invisible to recovery sweeps and stale lock detection.

---

## Quick Reference

| Topic | Description | Agents |
|-------|-------------|--------|
| supabase-queries | PostgREST NULL handling, pagination, JSONB | backend-dev, platform-engineer, code-reviewer, migration-schema-specialist |
| pipeline-safety | Terminal states, stale locks, queue processing | backend-dev, enrichment-pipeline-dev, outreach-system-dev, reality-checker |
| hydration | Next.js hydration error prevention | full-stack-dev, ui-component-dev, code-reviewer, evidence-collector |
| deploy-safety | Railway deploy paths, build configs, active run checks | deploy-specialist, chief-of-staff, reality-checker |
| api-integration | Twitter, Grok, InboxApp, CMC, DexScreener | api-integration-dev, twitter-data-specialist, grok-llm-specialist, inboxapp-specialist |
| entity-classification | Account type determination, rules, evaluation | entity-classification-dev, autoresearch-specialist, sales-intel-lead |
| cost-tracking | API cost awareness, budget enforcement, ledger | cost-budget-analyst, backend-dev, platform-engineer |
| dm-quality | DM writing, FUD patterns, reply hooks, AI-tells | dm-quality-specialist, outreach-system-dev, sales-intel-lead |
| token-validation | Symbol discovery, cashtag ownership, CMC/DEX | token-symbol-specialist, enrichment-pipeline-dev |
| outreach-pipeline | DM queue, InboxApp, reply detection, sequences | outreach-system-dev, inboxapp-specialist, dm-quality-specialist |
| scoring | Entity score, intent score, playbook matching | scoring-system-dev, enrichment-pipeline-dev |
| discovery | Agentic search, strategy, swarm, data sources | discovery-engine-dev, pipeline-ops-lead |
| brand-compliance | Colors, typography, dark-mode, prohibited patterns | ui-component-dev, full-stack-dev, evidence-collector |
| security | Auth, RLS, secrets, webhooks, infrastructure | security-auditor, data-protection-analyst, infra-security-reviewer |
| operations | Health monitoring, continuous audit, scripts | health-monitor, continuous-audit-specialist, ops-scripts-specialist |
| advisory | DM review, technical credibility, pipeline ROI, compliance | defi-project-founder, protocol-cto, sales-ops-analyst, compliance-reviewer |
| qa-validation | Issue validation, false positive patterns, adversarial testing | code-reviewer, engineering-challenger, adversary |

---

## supabase-queries
- **backend-dev.md**: (learnings will accumulate)
- **platform-engineer.md**: (learnings will accumulate)
- **migration-schema-specialist.md**: (learnings will accumulate)
- **code-reviewer.md**: (learnings will accumulate)

## pipeline-safety
- **enrichment-pipeline-dev.md**: (learnings will accumulate)
- **outreach-system-dev.md**: (learnings will accumulate)

## hydration
- **full-stack-dev.md**: (learnings will accumulate)
- **ui-component-dev.md**: (learnings will accumulate)
- **evidence-collector.md**: (learnings will accumulate)

## deploy-safety
- **deploy-specialist.md**: (learnings will accumulate)
- **chief-of-staff.md**: (learnings will accumulate)

## api-integration
- **api-integration-dev.md**: (learnings will accumulate)
- **twitter-data-specialist.md**: (learnings will accumulate)
- **grok-llm-specialist.md**: (learnings will accumulate)
- **inboxapp-specialist.md**: (learnings will accumulate)

## entity-classification
- **entity-classification-dev.md**: (learnings will accumulate)
- **autoresearch-specialist.md**: (learnings will accumulate)

## cost-tracking
- **cost-budget-analyst.md**: (learnings will accumulate)
- **platform-engineer.md**: (learnings will accumulate)

## dm-quality
- **dm-quality-specialist.md**: (learnings will accumulate)
- **outreach-system-dev.md**: (learnings will accumulate)

## token-validation
- **token-symbol-specialist.md**: (learnings will accumulate)
- **enrichment-pipeline-dev.md**: (learnings will accumulate)

## outreach-pipeline
- **outreach-system-dev.md**: (learnings will accumulate)
- **inboxapp-specialist.md**: (learnings will accumulate)

## scoring
- **scoring-system-dev.md**: (learnings will accumulate)
- **enrichment-pipeline-dev.md**: (learnings will accumulate)

## discovery
- **discovery-engine-dev.md**: (learnings will accumulate)
- **pipeline-ops-lead.md**: (learnings will accumulate)

## brand-compliance
- **ui-component-dev.md**: (learnings will accumulate)
- **full-stack-dev.md**: (learnings will accumulate)
- **evidence-collector.md**: (learnings will accumulate)

## security
- **security-auditor.md**: (learnings will accumulate)
- **data-protection-analyst.md**: (learnings will accumulate)
- **infra-security-reviewer.md**: (learnings will accumulate)

## operations
- **health-monitor.md**: (learnings will accumulate)
- **continuous-audit-specialist.md**: (learnings will accumulate)
- **ops-scripts-specialist.md**: (learnings will accumulate)

## advisory
- **defi-project-founder.md**: (learnings will accumulate)
- **protocol-cto.md**: (learnings will accumulate)
- **sales-ops-analyst.md**: (learnings will accumulate)
- **compliance-reviewer.md**: (learnings will accumulate)

## qa-validation
- **code-reviewer.md**: (learnings will accumulate)
- **engineering-challenger.md**: (learnings will accumulate)
- **adversary.md**: (learnings will accumulate)
