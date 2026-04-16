# assure-sales-pipeline Agent System

40 agents organized across 8 team directories with persistent memory.

## Agent Roster

### Team Leads (Tier 1 — User talks to these)
| Agent | File | Purpose |
|-------|------|---------|
| Dev Team Lead | `teams/dev-team-lead.md` | Coordinates engineering + QA for all coding tasks |
| Pipeline Operations Lead | `teams/pipeline-ops-lead.md` | Coordinates discovery, enrichment, and outreach execution |
| Data & Analytics Lead | `teams/data-analytics-lead.md` | Coordinates dashboard features, analytics, and monitoring |
| Sales Intel Lead | `teams/sales-intel-lead.md` | Coordinates DM quality, classification tuning, and playbook optimization |

### Executive / Strategy (Tier 2 — User talks to these directly)
| Agent | File | Purpose |
|-------|------|---------|
| VP Product | `executive/vp-product.md` | Feature prioritization, roadmap, product-market fit |
| Chief of Staff | `executive/chief-of-staff.md` | Cross-team coordination, blocker removal, operational cadence |

### Engineering Builders (Tier 3 — Team leads spawn these)
| Agent | File | Purpose |
|-------|------|---------|
| Full-Stack Dev | `engineering/full-stack-dev.md` | Next.js/React dashboard implementation |
| Backend Dev | `engineering/backend-dev.md` | General outreach-bot + lead-enrichment work |
| Platform Engineer | `engineering/platform-engineer.md` | Database, Supabase, migrations, infrastructure |
| Discovery Engine Dev | `engineering/discovery-engine-dev.md` | Agentic discovery system (coordinator, strategy, swarm) |
| Enrichment Pipeline Dev | `engineering/enrichment-pipeline-dev.md` | Enrichment pipeline (pipeline.ts, worker, providers) |
| Outreach System Dev | `engineering/outreach-system-dev.md` | DM queue, sender service, reply tracking, thread linking |
| Entity Classification Dev | `engineering/entity-classification-dev.md` | Deterministic + Grok classifier, prequal, learned rules |
| API Integration Dev | `engineering/api-integration-dev.md` | External API clients (Twitter, Grok, CMC, DexScreener, etc.) |
| Scoring System Dev | `engineering/scoring-system-dev.md` | Lead scoring module (entity + intent scores, tiers) |
| UI Component Dev | `engineering/ui-component-dev.md` | Dashboard component library, design system, brand compliance |

### Testing / QA (Tier 4 — Team leads spawn these)
| Agent | File | Purpose |
|-------|------|---------|
| Code Reviewer | `testing/code-reviewer.md` | Reviews code for correctness, style, edge cases |
| Reality Checker | `testing/reality-checker.md` | Integration validation, build verification |
| Evidence Collector | `testing/evidence-collector.md` | Screenshot-based UI QA at multiple viewports |
| Engineering Challenger | `testing/engineering-challenger.md` | Validates Code Review findings before fixes are attempted |
| Adversary | `testing/adversary.md` | Adversarial testing — reads diffs and tries to break changes |

### Security (Tier 5)
| Agent | File | Purpose |
|-------|------|---------|
| Security Auditor | `security/security-auditor.md` | Auth, OWASP, secrets, webhook signatures |
| Data Protection Analyst | `security/data-protection-analyst.md` | RLS policies, PII handling, multi-tenant isolation |
| Infra Security Reviewer | `security/infra-security-reviewer.md` | Deploy configs, env vars, CORS, secrets management |

### Domain Specialists (Tier 5 — Deep expertise in specific areas)
| Agent | File | Purpose |
|-------|------|---------|
| DM Quality Specialist | `domain/dm-quality-specialist.md` | DM writing quality, FUD patterns, reply hooks, AI-tell removal |
| Token & Symbol Specialist | `domain/token-symbol-specialist.md` | Token discovery, cashtag validation, symbol ownership |
| Twitter Data Specialist | `domain/twitter-data-specialist.md` | Twitter API integration, activity gate, data normalization |
| Grok LLM Specialist | `domain/grok-llm-specialist.md` | Grok API, prompt engineering, output parsing |
| Cost & Budget Analyst | `domain/cost-budget-analyst.md` | API cost tracking, budget enforcement, cost optimization |
| Autoresearch Specialist | `domain/autoresearch-specialist.md` | Entity classification evaluation, rule tuning, dataset management |
| InboxApp Specialist | `domain/inboxapp-specialist.md` | InboxApp REST API, webhooks, thread management |
| Migration & Schema Specialist | `domain/migration-schema-specialist.md` | Supabase migrations, schema evolution, trigger safety |

### Operations (Tier 5)
| Agent | File | Purpose |
|-------|------|---------|
| Deploy Specialist | `operations/deploy-specialist.md` | Railway/Vercel deployments, service orchestration |
| Ops Scripts Specialist | `operations/ops-scripts-specialist.md` | Repair scripts, backfills, batch operations |
| Health Monitor | `operations/health-monitor.md` | System health, API health, agent productivity |
| Continuous Audit Specialist | `operations/continuous-audit-specialist.md` | Pipeline quality auditing, DQ calibration |

### Advisory Personas (Tier 6 — Review work, don't build)
| Agent | File | Purpose |
|-------|------|---------|
| DeFi Project Founder | `advisory/defi-project-founder.md` | Reviews DMs from the prospect's perspective |
| Protocol CTO | `advisory/protocol-cto.md` | Reviews technical credibility of security pitches |
| Sales Ops Analyst | `advisory/sales-ops-analyst.md` | Reviews pipeline efficiency and ROI metrics |
| Compliance Reviewer | `advisory/compliance-reviewer.md` | Reviews data handling, messaging compliance, ToS |

## Agent Memory System

Every agent has a persistent memory file at `memory/{agent-name}.md`. Memory files are committed to git — the whole team benefits from every agent's learnings.

| Directory | Agents | Memory Files |
|-----------|--------|-------------|
| `teams/` | 4 | 4 |
| `executive/` | 2 | 2 |
| `engineering/` | 10 | 10 |
| `testing/` | 5 | 5 |
| `security/` | 3 | 3 |
| `domain/` | 8 | 8 |
| `operations/` | 4 | 4 |
| `advisory/` | 4 | 4 |
| **Total** | **40** | **40** |

## Shared Resources

| File | Purpose |
|------|---------|
| `memory/INDEX.md` | Cross-agent topic index + global constraints |
| `memory/LIFECYCLE.md` | Memory entry lifecycle specification |
| `strategy/nexus.md` | Operating modes and quality gates |
| `strategy/handoff-templates.md` | Agent-to-agent context passing formats |
| `strategy/activation-prompts.md` | Copy-paste prompts for every agent |
| `strategy/domain/assure-defi.md` | Product and domain context |

## Dispatch

- **`/build [task]`** — Routes implementation tasks to the right builder agent
- **`/qa`** — Tiered quality gate before commits (Mechanical → Standard → Full)
- **Direct dispatch**: For tasks outside `/build` routing, read this roster and dispatch the appropriate team lead or specialist directly
