# Operating Protocol — assure-sales-pipeline

## Product Mode (Feature Development)

Phase 0: Discovery      → Read requirements, current code, dependencies
Phase 1: Strategy       → Determine agent routing, identify risks
Phase 2: Foundation     → Scaffolding (new files, types, tests)
Phase 3: Build          → Builder implements + Reviewer reviews + QA validates
Phase 4: Hardening      → Reality Checker end-to-end + edge cases
Phase 5: Launch         → Commit, push, verify build
Phase 6: Operate        → Monitor for regressions, update learnings

## Quality Gates

| Gate | After Phase | Keeper | Criteria |
|------|-------------|--------|----------|
| G0 | Discovery | Dev Team Lead | Task understood, files identified |
| G1 | Strategy | Dev Team Lead | Approach approved, agents selected |
| G2 | Foundation | Builder | Scaffolding compiles, tests pass |
| G3 | Build | Code Reviewer | Code review passed, no critical issues |
| G4 | Hardening | Reality Checker | Zero regressions, all packages build |
| G5 | Launch | Human | Final approval |

## Dev→QA Loop (Phase 3)

Builder builds feature
  → Code Reviewer reviews diff
    → PASS: advance to Phase 4
    → FAIL: send specific failure details back to Builder
      → Builder fixes → re-run review (max 3 attempts → escalate)

## Escalation Protocol

When an agent fails 3 times:
1. Produce escalation report (what was attempted, why it failed, root cause)
2. Route to the user with recommended path forward

## Package Boundaries

| Package | Primary Agents | Coordinator | Deploy Target |
|---------|---------------|-------------|---------------|
| `dashboard/` | Full-Stack Dev, UI Component Dev | Data & Analytics Lead | Vercel |
| `outreach-bot/src/agentic-discovery/` | Discovery Engine Dev | Pipeline Ops Lead | Railway (discovery-engine) |
| `outreach-bot/src/workers/`, `services/` | Outreach System Dev, InboxApp Specialist | Pipeline Ops Lead | Railway (outreach-bot) |
| `outreach-bot/src/prequal/` | Entity Classification Dev | Sales Intel Lead | Railway (discovery-engine) |
| `lead-enrichment/src/core/` | Enrichment Pipeline Dev | Pipeline Ops Lead | Railway (sales-pipeline-enrichment) |
| `lead-enrichment/src/scoring/` | Scoring System Dev | Pipeline Ops Lead | Railway (sales-pipeline-enrichment) |
| `lead-enrichment/scripts/` | Ops Scripts Specialist | Pipeline Ops Lead | N/A (local execution) |
| `supabase/migrations/` | Migration & Schema Specialist | Dev Team Lead | Supabase |
| `autoresearch/` | Autoresearch Specialist | Sales Intel Lead | N/A (local execution) |

## Deployment Modes

| Mode | Agents | Use Case |
|------|--------|----------|
| **Micro** | 1-2 | Quick fix, single file, one package |
| **Sprint** | 4-8 | Feature build with QA |
| **Campaign** | 8-15 | Cross-package feature, pipeline changes |
| **Full** | All 39 | Architecture change, security audit, full review |

Default to Micro. Escalate when complexity demands it.

## Team Coordination Map

```
User
├── Dev Team Lead ─────── General engineering tasks
│   ├── Full-Stack Dev, Backend Dev, Platform Engineer
│   ├── Code Reviewer, Reality Checker
│   └── Security Auditor (when security-relevant)
│
├── Pipeline Ops Lead ─── Discovery/enrichment/outreach pipeline
│   ├── Discovery Engine Dev, Enrichment Pipeline Dev, Outreach System Dev
│   ├── API Integration Dev, Deploy Specialist
│
├── Data & Analytics Lead ─ Dashboard and monitoring
│   ├── Full-Stack Dev, UI Component Dev
│   ├── Health Monitor, Evidence Collector
│   └── Cost & Budget Analyst
│
├── Sales Intel Lead ───── DM quality and classification
│   ├── DM Quality Specialist, Entity Classification Dev
│   ├── Autoresearch Specialist, Token & Symbol Specialist
│   └── Advisory Personas (parallel review)
│
├── VP Product ─────────── Feature prioritization, roadmap
├── Chief of Staff ─────── Cross-team coordination, operations
│
└── /build, /qa ─────────── Automatic dispatch via skills
```
