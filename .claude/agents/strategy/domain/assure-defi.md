# Assure DeFi — Product & Domain Context

Reference material for all agents. Understand the domain before generating any output.

## Company Overview
- **Company**: Assure DeFi
- **Industry**: Crypto/DeFi security and trust services
- **Product**: Sales pipeline platform for crypto project outreach
- **Target Market**: DeFi protocols, crypto projects, and token launches needing security audits, trust marketing, and partnership services

## Products & Services
1. **Security Audits** — Smart contract and protocol security reviews
2. **Trust Marketing** — KYC verification, trust badges, marketing services for crypto projects
3. **Partnership Outreach** — Automated discovery and outreach to potential clients

## The Sales Pipeline Platform (This Codebase)

### What It Does
An automated pipeline that discovers crypto projects on Twitter/X, evaluates them, enriches their data, scores them, and sends personalized DMs to initiate sales conversations.

### Key Workflows
1. **Discovery** — Grok-powered agentic search finds crypto project accounts on Twitter
2. **Enrichment** — Detailed data collection on each account (followers, activity, token info, account summary)
3. **Scoring** — Entity score (account quality) + intent score (fit for playbook) determine priority
4. **Classification** — Accounts classified as Project/Token, Company, or Individual
5. **Outreach** — Personalized DMs sent via InboxApp with reply detection

### Architecture
| Component | Package | Deploy |
|-----------|---------|--------|
| Discovery Engine | repo root (`outreach-bot/`) | Railway: discovery-engine |
| Enrichment Worker | `lead-enrichment/` | Railway: sales-pipeline-enrichment |
| DM Outreach | `outreach-bot/` | Railway: outreach-bot |
| Dashboard | `dashboard/` | Vercel |
| Database | `supabase/` | Supabase (PostgreSQL) |

### Key External APIs
- **Grok (xAI)** — Account discovery and summarization (~$0.05-0.10/lead)
- **twitterapi.io** — Twitter data (followers, tweets, activity)
- **InboxApp** — DM sending and reply detection
- **CoinMarketCap** — Token data and symbol validation
- **DexScreener** — DEX pair data and token ownership

### Key Database Tables
- `leads` — Qualified accounts in the pipeline
- `crypto_accounts` — Permanent entity data (the product)
- `discovery_search_runs` — Discovery run tracking
- `outreach_messages` — DM queue and delivery status
- `dm_conversation_events` — Conversation history
- `cost_ledger` — API cost tracking (append-only)

## Team
- **Jeff** (founder) — Primary user, makes architecture decisions
- **Tom** — Business contact (tom@assuredefi.com)
- **@el_crypto_chapo** / **@assuredefi** — X accounts used for outreach

## Revenue Model
Services sold to crypto projects: security audits, trust marketing packages, partnership deals.
Pipeline ROI measured by: cost per DM-ready lead (~$0.216), reply rate, conversion to paid services.

## Brand
- **Colors**: Navy (#0A0724), Gold (#E2D243), Light Grey (#F2F2F2), White, Black
- **Font**: Inter
- **Tone**: Professional, high-trust, serious — NOT playful
- **Dark-mode first** — Navy background is default

## Key Domain Terms
| Term | Meaning |
|------|---------|
| Entity score | Universal quality score for an account (0-100) |
| Intent score | Per-query fit score (how well account matches playbook) |
| Playbook | Sales motion template (security, trust_marketing, partnership, kill_switch) |
| Lead tier | S/A/B/C/D based on lead_score |
| Activity gate | 30-day tweet threshold — inactive accounts are filtered |
| Cashtag | $TICKER symbol in bio — ownership validation required |
| Pool candidates | Accounts from prior discovery runs checked for free |
