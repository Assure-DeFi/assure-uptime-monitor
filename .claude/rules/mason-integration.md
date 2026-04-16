# Mason Integration Rules

These rules apply to ALL Mason-related commands (`/execute-approved`, `/pm-review`, etc.).

## Database Architecture

Mason is a **separate platform** that manages system improvements for multiple repositories. It has its own Supabase tables with the `mason_` prefix.

### Correct Table Names

| Purpose | Table Name | Note |
|---------|------------|------|
| Backlog items | `mason_pm_backlog_items` | Multi-tenant, requires repository_id filter |
| Execution runs | `mason_pm_execution_runs` | Tracks command executions |
| Execution tasks | `mason_pm_execution_tasks` | Individual task progress |

### WRONG - Deprecated Tables (DELETED)

These tables were the OLD internal system improvements feature and have been **removed**:
- ~~`pm_backlog_items`~~ - DELETED
- ~~`pm_execution_runs`~~ - DELETED
- ~~`pm_execution_tasks`~~ - DELETED
- ~~`pm_analysis_runs`~~ - DELETED
- ~~`systems_improvement_user_roles`~~ - DELETED

**Never recreate these tables.** All system improvements work goes through Mason.

## Configuration

Read all Mason settings from `mason.config.json` in the project root:

```json
{
  "supabaseUrl": "https://xxx.supabase.co",
  "supabaseAnonKey": "eyJ...",
  "repositoryId": "uuid-of-this-repo",
  "tableName": "mason_pm_backlog_items"
}
```

### Required Fields

| Field | Description |
|-------|-------------|
| `supabaseUrl` | Mason's Supabase project URL |
| `supabaseAnonKey` | Anon key for REST API access |
| `repositoryId` | UUID identifying this repo in Mason's multi-tenant database |
| `tableName` | The backlog items table (always `mason_pm_backlog_items`) |

## Querying Mason Data

### Use REST API, NOT MCP SQL

The MCP Supabase connection may not have access to Mason tables. **Always use curl with REST API**:

```bash
SUPABASE_URL=$(jq -r '.supabaseUrl' mason.config.json)
SUPABASE_KEY=$(jq -r '.supabaseAnonKey' mason.config.json)
REPO_ID=$(jq -r '.repositoryId' mason.config.json)

# Get approved items for this repo
curl -s "${SUPABASE_URL}/rest/v1/mason_pm_backlog_items?repository_id=eq.${REPO_ID}&status=eq.approved&order=priority_score.desc" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}"
```

### Status Values

| Status | Meaning |
|--------|---------|
| `new` | Awaiting review in Mason dashboard |
| `approved` | Ready for `/execute-approved` |
| `in_progress` | Currently being implemented |
| `completed` | Implementation finished |
| `rejected` | Not approved for implementation |
| `deferred` | Postponed for later |

## Updating Item Status

Use PATCH requests to update status:

```bash
# Mark as in_progress when starting
curl -X PATCH "${SUPABASE_URL}/rest/v1/mason_pm_backlog_items?id=eq.${ITEM_ID}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status": "in_progress", "branch_name": "mason/feature-name"}'

# Mark as completed when done
curl -X PATCH "${SUPABASE_URL}/rest/v1/mason_pm_backlog_items?id=eq.${ITEM_ID}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status": "completed", "pr_url": "https://github.com/..."}'
```

## Common Mistakes

| Mistake | Why It's Wrong | Correct Approach |
|---------|----------------|------------------|
| Query `pm_backlog_items` | Old table, deleted | Use `mason_pm_backlog_items` |
| Use MCP SQL for Mason | May not have access | Use REST API via curl |
| Query without repository_id | Gets all repos' data | Always filter by repositoryId |
| Check status via old tables | Tables don't exist | Query Mason tables via REST |

## Dashboard Access

The Mason dashboard is at: **https://mason.assuredefi.com/admin/backlog**

- Review and approve items there
- View PRD content
- Track execution progress
- Filter by repository

## Related Skills

- `/execute-approved` - Execute approved items from Mason backlog
- `/pm-review` - Run PM analysis and submit improvements to Mason
