# Railway Deployments Reference

Canonical index of every Railway project in the Assure ecosystem.
**DO NOT deploy to, set variables on, or modify any service without confirming the correct entry here first.**

---

## Workspaces

| Workspace | ID | Owner |
|-----------|-----|-------|
| elcryptochapo's Projects | `e540ab24-820b-4d22-9fdc-0c88138b8f6a` | Personal (trial expired — do NOT create projects here) |
| Assure Marketing's Projects | `9a41c7e9-d363-419a-9463-a3467a915a41` | Active workspace for all Assure services |

---

## Active Services (assure-sales-pipeline repo)

### discovery-engine
- **Railway Project:** discovery-engine (`bbf8f61c-1fbc-4b3d-8a4f-8e9a9b1937dc`)
- **Service:** discovery-engine (`36e604e8-0b0d-4e18-a9da-8e398843c595`)
- **Environment:** production (`b89bfd53-892c-45dc-bfdc-c44941e4db92`)
- **Local path:** `/home/jeffl/projects/assure-sales-pipeline`
- **Deploy command:** `railway up` from `assure-sales-pipeline/` root
- **Purpose:** Agentic discovery engine — runs discovery search runs, candidate evaluation, swarm coordination
- **URL:** `discovery-engine-production.up.railway.app`

### sales-pipeline-enrichment (sales-worker)
- **Railway Project:** sales-pipeline-enrichment (`ce7be8d6-3f28-4129-85b7-64b111a32701`)
- **Service:** sales-worker (`64a16ef0-55ea-46f2-af9b-1458f988822c`)
- **Environment:** production (`94ab1bd4-1905-42c1-a6c1-863fe16b6096`)
- **Local path:** `/home/jeffl/projects/assure-sales-pipeline/lead-enrichment`
- **Deploy command:** `railway up` from `lead-enrichment/`
- **Purpose:** Lead enrichment worker — processes Redis queue, runs Grok enrichment pipeline, writes to leads + crypto_accounts
- **Notes:** This is the ACTIVE enrichment service. The older `sincere-forgiveness` project (below) is a deprecated predecessor.

### outreach-bot
- **Railway Project:** outreach-bot (`0435f189-c79f-41e7-a80d-2cc24155c29c`)
- **Service:** outreach-bot (`b34f5927-f237-467c-9d3f-494e75d09ef0`)
- **Environment:** production (`ba0c0418-cf8e-4bb0-9147-b5333b997179`)
- **Local path:** `/home/jeffl/projects/assure-sales-pipeline/outreach-bot`
- **Deploy command:** `railway up` from `outreach-bot/`
- **Purpose:** DM outreach worker — processes `outreach_messages` queue, sends via InboxApp (primary) with X API fallback
- **URL:** `https://outreach-bot-production.up.railway.app`
- **Webhook endpoint:** `https://outreach-bot-production.up.railway.app/api/inboxapp/webhook` — Hookdeck destination for InboxApp reply events
- **Safety flags:** `DM_SENDING_ENABLED=false`, `DM_DRY_RUN=true` — must be explicitly flipped to go live
- **Missing env vars:** `INBOXAPP_ENABLED`, `INBOXAPP_API_TOKEN`, `INBOXAPP_DEFAULT_ACCOUNT_LINK_ID` — required for InboxApp sending
- **WARNING:** Hookdeck destination must point to outreach-bot URL above, NOT discovery-engine URL

### inboxapp-reply-watcher
- **Railway Project:** reasonable-surprise (`dd638e9a-a01e-4fe4-bbce-ea303fe0f93e`)
- **Service:** inboxapp-reply-watcher
- **Local path:** unknown (separate repo or subdirectory)
- **Purpose:** Watches InboxApp for inbound replies to outreach DMs, syncs reply events to Supabase
- **Notes:** Created 2/12/2026. Related to outreach-bot but deployed separately.

---

## Other Active Services (separate repos)

### pm-execution-worker
- **Railway Project:** (project ID `90ef0308-a47b-40cb-9ae1-ed20d1dc1cfc`, name unknown — not in main project list, may be different workspace)
- **Service:** (`3f12bf4d-f3d9-422b-8933-e4d5b403b248`)
- **Local path:** `/home/jeffl/projects/assure-sales-pipeline/execution-worker`
- **Purpose:** Mason PM execution worker

### Assure Studio
- **Railway Project:** Assure Studio (`5e253112-955c-437f-8391-bdc3257f2dd2`)
- **Services:** assurestudio, Postgres
- **Purpose:** Assure Studio web application
- **Created:** 1/14/2026

### knowledge base dashboard
- **Railway Project:** knowledge base dashboard (`32217762-eccf-4fd6-bf9f-9cb25852883f`)
- **Services:** Postgres, KnowledgeBaseCms
- **Purpose:** Internal knowledge base CMS
- **Created:** 2/25/2026

---

## Deprecated / Legacy Services (do not touch)

| Project | ID | Services | Notes |
|---------|-----|----------|-------|
| sincere-forgiveness | `964cefdc` | Lead-Data-Enrichment-Engine | Old enrichment service — replaced by `sales-pipeline-enrichment` |
| Outreach Bot V2 | `89f8fc7b` | Postgres, Frontend, Backend | Old outreach system — replaced by `outreach-bot` |
| Templated Bot | `fb09f596` | templated-bot | Legacy bot |
| Notion Ops Bot | `29da908c` | test-database-ops-bot | Legacy ops bot |
| Assure Defi Bot | `bcab50c1` | Postgres, Assure-Launch-Bot | Legacy launch bot |
| Broadcast-Bot | `fc897891` | broadcast-bot, Postgres | Legacy broadcast system |

---

## Local Path → Railway Service Map

| Local path | Project | Service |
|------------|---------|---------|
| `assure-sales-pipeline/` (root) | discovery-engine | discovery-engine |
| `assure-sales-pipeline/lead-enrichment` | sales-pipeline-enrichment | sales-worker |
| `assure-sales-pipeline/outreach-bot` | outreach-bot | (pending) |
| `assure-sales-pipeline/execution-worker` | pm-execution-worker | (execution-worker service) |

---

## Safety Rules

1. **Never deploy from root** to anything other than `discovery-engine`
2. **Never set variables on deprecated projects** — they are not in use
3. **outreach-bot DM sending** is gated by `DM_SENDING_ENABLED=false` — confirm with Jeff before flipping
4. **InboxApp vars** must be set before enabling InboxApp: `INBOXAPP_ENABLED`, `INBOXAPP_API_TOKEN`, `INBOXAPP_DEFAULT_ACCOUNT_LINK_ID`
5. **Always confirm Railway project context** with `railway status` before deploying or setting variables
