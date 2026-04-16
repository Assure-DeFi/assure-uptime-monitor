# Naming Conventions

Canonical glossary for entity naming across the codebase. This is the source of truth.

## Entity Glossary

| Concept | Name | DB Table | Notes |
|---------|------|----------|-------|
| Discovery search configuration | **Discovery Query** | `discovery_queries` | Intent, budget, polling, search terms |
| Single execution of a discovery query | **Discovery Run** | `discovery_search_runs` | Links to query via `query_id` |
| Unqualified account found by discovery | **Candidate** | `leads` (pre-qualification) | Before formal qualification |
| Qualified, enriched account | **Lead** | `leads` (post-qualification) | Assigned to outreach campaign |
| Outreach sales motion | **Campaign** | `campaigns` | Qualification + messaging + outreach |

## Rules

- **"Campaign"** = ONLY outreach campaigns. Never use for discovery configurations.
- **"Query"** = a discovery search configuration (intent, budget, polling, search terms).
- **"Candidate"** = any account found by discovery before formal qualification.
- **"Lead"** = formally ingested, enriched account assigned to an outreach campaign.
- **"Run"** = a single execution of a discovery query.

## Code Naming

| Context | Type Name | Variable Name |
|---------|-----------|---------------|
| Discovery config | `DiscoveryQuery` | `query`, `discoveryQuery` |
| Discovery execution | `DiscoveryRun` / `SearchRun` | `run`, `searchRun` |
| Pre-qualification account | `DiscoveredCandidate` | `candidate` |
| Post-qualification account | `Lead` | `lead` |
| Outreach motion | `Campaign` | `campaign` |

## Entity Type (Account Classification)

**Canonical values** (3 only): `Project/Token`, `Company`, `Individual`

| DB Column | TS Type | Values |
|-----------|---------|--------|
| `account_type` | `AccountType` | `'Project/Token' \| 'Company' \| 'Individual'` |

- DB column name: `account_type` (never rename)
- TS type: `AccountType` in `lead-enrichment/src/core/types.ts`
- Grok prompts constrained to these 3 values
- DAOs → `Project/Token` (they have governance tokens)
- Token symbol/contract exists → always `Project/Token` regardless of Grok classification
- `'unknown'` is NOT a valid value. Null if truly unclassifiable.
- Legacy lowercase values (`project`, `company`, `individual`, `dao`, `unknown`) normalized at all boundaries

## DB Column Naming

| Table | Column | Purpose |
|-------|--------|---------|
| `leads` | `discovery_query_id` | FK to discovery_queries |
| `leads` | `source_query` | Name of discovery query |
| `discovery_search_runs` | `query_id` | FK to discovery_queries |

## Deprecated Names (do not use in new code)

| Old Name | New Name |
|----------|----------|
| `DiscoveryCampaign` | `DiscoveryQuery` |
| `IntentCampaign` | `DiscoveryQuery` |
| `DiscoveredLead` | `DiscoveredCandidate` |
| `HybridDiscoveryLead` | `HybridDiscoveryCandidate` |
| `discovery_campaign_id` | `discovery_query_id` |
| `source_campaign` (discovery) | `source_query` |
| `campaign_id` (on runs) | `query_id` |
| `campaign_type` | `query_type` |
| `is_system_campaign` | `is_system_query` |
