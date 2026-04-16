# PRD: Campaign Lead Visibility & Sales Workflow System

## Document Info
- **Version**: 1.0
- **Created**: 2026-01-21
- **Status**: Ready for Implementation
- **Execution Mode**: Ralph Loop - Autonomous, Single Phase

---

## Executive Summary

Build the campaign-to-lead visibility layer enabling sales teams to view leads within campaigns, manage lead states, export CSVs for external messaging via InboxApp, and track replies automatically. This connects the existing campaign system to actionable sales workflows with real-time dashboard updates.

---

## Problem Statement

Currently:
- Campaigns exist but don't show which leads belong to them
- No way to see lead counts or states within a campaign
- No CSV export for external messaging tools
- No tracking of which leads have been messaged vs are new
- Dashboard metrics show mock data, not real lead data
- Campaign priority exists in UI but doesn't affect lead assignment

---

## Goals

1. **Lead Visibility**: Sales can see all leads in a campaign with filtering and sorting
2. **State Management**: Track New → Messaged → Replied lifecycle per lead
3. **Export Workflow**: Generate CSVs with template merge fields for InboxApp
4. **Auto Reply Tracking**: InboxApp webhooks auto-update lead states
5. **Real Metrics**: Dashboard shows accurate counts from actual lead data
6. **Priority Assignment**: Campaigns claim leads by priority order

---

## User Stories

### US-1: View Leads in Campaign
As a sales team member, I want to see all leads assigned to a campaign in a table view so I can understand my outreach pool.

**Acceptance Criteria:**
- Table shows: X handle (clickable link), Company/Project name, Lead state badge
- Table is sortable by any column
- Table supports row selection for bulk actions
- Pagination at 50 leads per page
- Real-time updates when lead data changes

### US-2: Filter Leads by State
As a sales team member, I want to filter leads by their outreach state so I can focus on unmessaged leads.

**Acceptance Criteria:**
- Filter dropdown with options: All, New, Messaged, Skipped, Replied
- Filter persists during session
- Count badge shows number in each state

### US-3: Export Leads for Messaging
As a sales team member, I want to export selected leads to CSV so I can message them via InboxApp.

**Acceptance Criteria:**
- Select leads via checkboxes (individual or select all)
- Export button generates CSV download
- CSV includes X handle + all `{{field}}` variables from campaign message template
- Warning shown if any selected leads were previously exported
- Export logged with timestamp and count

### US-4: Mark Leads as Messaged
As a sales team member, after messaging leads externally, I want to mark them as Messaged so the system tracks my progress.

**Acceptance Criteria:**
- Select leads and click "Mark as Messaged" button
- State changes to "Messaged" with timestamp
- Stats update immediately
- Event logged to lead history

### US-5: Skip/Exclude Leads
As a sales team member, I want to skip leads that aren't a good fit so they're excluded from my active pool.

**Acceptance Criteria:**
- Individual skip via row action menu
- Bulk skip via selection + button
- State changes to "Skipped"
- Skipped leads remain visible but clearly marked

### US-6: View Lead Details
As a sales team member, I want to view full details of a lead including their history and add notes.

**Acceptance Criteria:**
- Click lead row opens detail panel/modal
- Shows all profile data (X handle, company, enrichment fields)
- Shows state change history timeline
- Shows why lead matched this campaign (on-demand)
- Free-form notes field with auto-save

### US-7: Auto-Track Replies
As a sales team member, when a lead replies via InboxApp, I want their state to automatically update to Replied.

**Acceptance Criteria:**
- InboxApp webhook triggers state change
- Lead state becomes "Replied"
- Event logged with reply timestamp
- Dashboard stats update in real-time

### US-8: See Campaign Stats
As a sales team member, I want to see accurate statistics for each campaign.

**Acceptance Criteria:**
- Campaign shows: Total leads, New count, Messaged count, Skipped count, Replied count, Reply rate %
- Stats computed from actual lead data
- Stats update in real-time

### US-9: Campaign Priority Assignment
As a system, leads should be assigned to the highest priority campaign they qualify for.

**Acceptance Criteria:**
- Campaigns have priority order (drag-drop UI exists)
- When lead is created/updated, evaluate campaigns by priority
- First matching campaign claims the lead
- Lead can only belong to one campaign

---

## Technical Specifications

### Database Schema

#### New Enum: `outreach_state_enum`
```sql
CREATE TYPE outreach_state_enum AS ENUM ('new', 'messaged', 'skipped', 'replied');
```

#### Leads Table Additions
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| outreach_state | outreach_state_enum | 'new' | Current messaging state |
| outreach_state_changed_at | timestamptz | null | When state last changed |
| last_exported_at | timestamptz | null | Last CSV export time |
| export_count | integer | 0 | Times exported |
| sales_notes | text | null | Free-form sales notes |

#### New Table: `export_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| campaign_id | uuid | FK to campaigns |
| lead_count | integer | Number of leads exported |
| lead_ids | uuid[] | Which leads were included |
| exported_by | text | User identifier |
| exported_at | timestamptz | Export timestamp |
| export_fields | text[] | Fields included in CSV |

### API Endpoints

#### GET /api/campaigns/[id]/leads
Returns paginated leads for a campaign with filtering.

Query params:
- `state`: Filter by outreach_state
- `page`: Page number (default 1)
- `limit`: Items per page (default 50)
- `sort`: Sort field
- `order`: asc/desc

#### POST /api/campaigns/[id]/leads/export
Generates CSV export for selected leads.

Body:
```json
{
  "leadIds": ["uuid1", "uuid2"],
  "fields": ["twitter_handle", "project_name", "symbol"]
}
```

#### POST /api/leads/bulk-update-state
Updates outreach_state for multiple leads.

Body:
```json
{
  "leadIds": ["uuid1", "uuid2"],
  "state": "messaged"
}
```

#### PATCH /api/leads/[id]/notes
Updates sales notes for a lead.

Body:
```json
{
  "notes": "Spoke with founder, interested in Q2"
}
```

#### POST /api/webhooks/inboxapp
Receives webhook events from InboxApp.

Payload (based on InboxApp docs):
```json
{
  "event": "reply_received",
  "external_user": {
    "username": "twitter_handle"
  },
  "message": {
    "text": "...",
    "timestamp": "..."
  }
}
```

### Component Architecture

```
/src/components/
├── leads/
│   ├── lead-table.tsx           # Main table component
│   ├── lead-table-columns.tsx   # Column definitions
│   ├── lead-table-actions.tsx   # Bulk action toolbar
│   ├── lead-table-filters.tsx   # State filter dropdown
│   ├── lead-row-actions.tsx     # Per-row action menu
│   ├── lead-detail-panel.tsx    # Slide-over detail view
│   ├── lead-state-badge.tsx     # State indicator badge
│   └── lead-notes-editor.tsx    # Notes textarea
├── campaigns/
│   ├── campaign-stats-cards.tsx # Stats display
│   ├── campaign-tabs.tsx        # Tab navigation
│   └── campaign-export-dialog.tsx # Export confirmation
```

### Real-time Subscriptions

Use existing `useLeadRealtime` hook pattern:
```typescript
const { leads, isConnected } = useLeadRealtime({
  campaignId: campaignId,
  onUpdate: (lead) => {
    // Refresh stats
  }
});
```

---

## MCP Tools Available for Implementation

### Supabase MCP
- `mcp__supabase__apply_migration` - Create database migrations
- `mcp__supabase__execute_sql` - Run SQL queries
- `mcp__supabase__list_tables` - Verify table structure
- `mcp__supabase__generate_typescript_types` - Regenerate types after schema changes

### Vercel MCP
- `mcp__vercel__deploy_to_vercel` - Deploy changes
- `mcp__vercel__get_deployment_build_logs` - Check deployment status

### File Operations
- `Read` - Read existing files
- `Write` - Create new files
- `Edit` - Modify existing files
- `Glob` - Find files by pattern
- `Grep` - Search code

### Testing
- `Bash` - Run tests, linting, builds

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Lead table loads | < 2 seconds for 500 leads |
| CSV export | < 5 seconds for 100 leads |
| Real-time update latency | < 1 second |
| Webhook processing | < 500ms |
| Zero data loss | All state changes persisted |

---

# TASKS

## Task 1: Database Migration - Outreach State Schema

### Description
Create Supabase migration to add outreach state tracking fields to leads table and create export_logs table.

### Context
The leads table exists at `/supabase/migrations/001_initial_schema.sql` with base fields. We need to add outreach-specific columns for the messaging workflow. The existing `lead_stage` enum tracks the qualification funnel (discovered → won), while the new `outreach_state` tracks the messaging lifecycle (new → messaged → replied).

### Files to Create
- `/supabase/migrations/019_outreach_state_schema.sql`

### Implementation Details

```sql
-- Migration: 019_outreach_state_schema.sql
-- Purpose: Add outreach state tracking for sales messaging workflow

-- 1. Create outreach state enum
CREATE TYPE outreach_state_enum AS ENUM ('new', 'messaged', 'skipped', 'replied');

-- 2. Add outreach columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS outreach_state outreach_state_enum DEFAULT 'new',
ADD COLUMN IF NOT EXISTS outreach_state_changed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_exported_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS export_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_notes TEXT;

-- 3. Create export_logs table
CREATE TABLE IF NOT EXISTS export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_count INTEGER NOT NULL,
  lead_ids UUID[] NOT NULL DEFAULT '{}',
  exported_by TEXT,
  exported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  export_fields TEXT[] NOT NULL DEFAULT '{}'
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_campaign_outreach_state
ON leads(campaign_id, outreach_state);

CREATE INDEX IF NOT EXISTS idx_leads_outreach_state
ON leads(outreach_state);

CREATE INDEX IF NOT EXISTS idx_export_logs_campaign
ON export_logs(campaign_id);

-- 5. Create trigger to update outreach_state_changed_at
CREATE OR REPLACE FUNCTION update_outreach_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.outreach_state IS DISTINCT FROM NEW.outreach_state THEN
    NEW.outreach_state_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_outreach_state_timestamp ON leads;
CREATE TRIGGER trigger_outreach_state_timestamp
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION update_outreach_state_timestamp();

-- 6. Log outreach state changes to lead_events
CREATE OR REPLACE FUNCTION log_outreach_state_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.outreach_state IS DISTINCT FROM NEW.outreach_state THEN
    INSERT INTO lead_events (lead_id, event_type, event_data, actor)
    VALUES (
      NEW.id,
      'stage_changed',
      jsonb_build_object(
        'field', 'outreach_state',
        'from', OLD.outreach_state,
        'to', NEW.outreach_state
      ),
      'system'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_outreach_state ON leads;
CREATE TRIGGER trigger_log_outreach_state
AFTER UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION log_outreach_state_change();
```

### MCP Tools to Use
1. `mcp__supabase__apply_migration` with name="outreach_state_schema" and the SQL above
2. `mcp__supabase__list_tables` to verify leads table has new columns
3. `mcp__supabase__execute_sql` to verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'leads' AND column_name LIKE 'outreach%'`

### Success Criteria
- [ ] Migration applies without errors
- [ ] `outreach_state_enum` type exists
- [ ] leads table has 5 new columns
- [ ] export_logs table exists with correct schema
- [ ] Indexes created
- [ ] Triggers fire correctly on state change

### Testing Steps
```sql
-- Test 1: Verify enum exists
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'outreach_state_enum'::regtype;

-- Test 2: Verify columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads' AND column_name IN ('outreach_state', 'sales_notes', 'export_count');

-- Test 3: Test trigger by updating a lead
UPDATE leads SET outreach_state = 'messaged' WHERE id = (SELECT id FROM leads LIMIT 1);
SELECT outreach_state, outreach_state_changed_at FROM leads WHERE outreach_state = 'messaged' LIMIT 1;

-- Test 4: Verify event was logged
SELECT * FROM lead_events WHERE event_data->>'field' = 'outreach_state' ORDER BY created_at DESC LIMIT 1;
```

---

## Task 2: Database Migration - Campaign Priority Assignment

### Description
Create migration and database function to assign leads to campaigns based on priority order.

### Context
Campaign priority UI exists at `/Sales Pipeline Dashboard/src/components/config/priority-campaign-list.tsx` with drag-drop reordering. The API route at `/src/app/api/campaigns/reorder/route.ts` exists but uses mock data. We need:
1. Ensure campaigns.priority column exists
2. Create function to evaluate lead against campaign qualification_logic
3. Create function to assign lead to highest priority matching campaign

### Files to Create
- `/supabase/migrations/020_campaign_priority_assignment.sql`

### Implementation Details

```sql
-- Migration: 020_campaign_priority_assignment.sql
-- Purpose: Campaign priority-based lead assignment

-- 1. Ensure priority column exists on campaigns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS priority INTEGER;

-- 2. Create index for priority ordering
CREATE INDEX IF NOT EXISTS idx_campaigns_priority
ON campaigns(priority) WHERE priority IS NOT NULL AND status = 'PRODUCTION';

-- 3. Function to check if lead qualifies for a campaign
-- Note: qualification_logic is JSONB with structure like:
-- { "rules": [{ "field": "follower_count", "operator": ">=", "value": 1000 }] }
CREATE OR REPLACE FUNCTION evaluate_lead_qualification(
  p_lead_id UUID,
  p_qualification_logic JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  lead_record RECORD;
  rule RECORD;
  field_value TEXT;
  rule_value TEXT;
  passes BOOLEAN := TRUE;
BEGIN
  -- Get lead data
  SELECT * INTO lead_record FROM leads WHERE id = p_lead_id;

  IF lead_record IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If no qualification logic, lead qualifies
  IF p_qualification_logic IS NULL OR p_qualification_logic = '{}'::jsonb THEN
    RETURN TRUE;
  END IF;

  -- Check each rule (AND logic)
  FOR rule IN SELECT * FROM jsonb_array_elements(p_qualification_logic->'rules')
  LOOP
    -- Get field value from lead (handle nested JSON)
    field_value := lead_record.enrichment_data->>(rule.value->>'field');
    IF field_value IS NULL THEN
      -- Try direct column
      EXECUTE format('SELECT ($1).%I::text', rule.value->>'field')
      INTO field_value USING lead_record;
    END IF;

    rule_value := rule.value->>'value';

    -- Evaluate based on operator
    CASE rule.value->>'operator'
      WHEN '>=' THEN
        passes := passes AND (field_value::numeric >= rule_value::numeric);
      WHEN '>' THEN
        passes := passes AND (field_value::numeric > rule_value::numeric);
      WHEN '<=' THEN
        passes := passes AND (field_value::numeric <= rule_value::numeric);
      WHEN '<' THEN
        passes := passes AND (field_value::numeric < rule_value::numeric);
      WHEN '=' THEN
        passes := passes AND (field_value = rule_value);
      WHEN '!=' THEN
        passes := passes AND (field_value != rule_value);
      WHEN 'contains' THEN
        passes := passes AND (field_value ILIKE '%' || rule_value || '%');
      WHEN 'not_null' THEN
        passes := passes AND (field_value IS NOT NULL AND field_value != '');
      ELSE
        -- Unknown operator, skip rule
        NULL;
    END CASE;

    -- Short circuit on failure
    IF NOT passes THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN passes;
EXCEPTION WHEN OTHERS THEN
  -- On any error, don't qualify
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 4. Function to assign lead to highest priority campaign
CREATE OR REPLACE FUNCTION assign_lead_to_campaign(p_lead_id UUID)
RETURNS UUID AS $$
DECLARE
  assigned_campaign_id UUID;
  campaign_record RECORD;
BEGIN
  -- Skip if lead already has a campaign
  SELECT campaign_id INTO assigned_campaign_id FROM leads WHERE id = p_lead_id;
  IF assigned_campaign_id IS NOT NULL THEN
    RETURN assigned_campaign_id;
  END IF;

  -- Iterate campaigns by priority (lowest number = highest priority)
  FOR campaign_record IN
    SELECT id, qualification_logic
    FROM campaigns
    WHERE status = 'PRODUCTION'
    AND priority IS NOT NULL
    ORDER BY priority ASC
  LOOP
    IF evaluate_lead_qualification(p_lead_id, campaign_record.qualification_logic) THEN
      -- Assign lead to this campaign
      UPDATE leads
      SET campaign_id = campaign_record.id
      WHERE id = p_lead_id;

      -- Log the assignment
      INSERT INTO lead_events (lead_id, event_type, event_data, actor)
      VALUES (
        p_lead_id,
        'field_updated',
        jsonb_build_object(
          'field', 'campaign_id',
          'value', campaign_record.id,
          'reason', 'priority_assignment'
        ),
        'system'
      );

      RETURN campaign_record.id;
    END IF;
  END LOOP;

  -- No matching campaign
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to reassign all unassigned leads (batch)
CREATE OR REPLACE FUNCTION reassign_unassigned_leads()
RETURNS INTEGER AS $$
DECLARE
  lead_record RECORD;
  assigned_count INTEGER := 0;
BEGIN
  FOR lead_record IN
    SELECT id FROM leads WHERE campaign_id IS NULL
  LOOP
    IF assign_lead_to_campaign(lead_record.id) IS NOT NULL THEN
      assigned_count := assigned_count + 1;
    END IF;
  END LOOP;

  RETURN assigned_count;
END;
$$ LANGUAGE plpgsql;
```

### MCP Tools to Use
1. `mcp__supabase__apply_migration` with name="campaign_priority_assignment" and the SQL above
2. `mcp__supabase__execute_sql` to test functions

### Success Criteria
- [ ] campaigns.priority column exists
- [ ] evaluate_lead_qualification function works
- [ ] assign_lead_to_campaign function works
- [ ] Events logged on assignment

### Testing Steps
```sql
-- Test 1: Create test campaign with priority
UPDATE campaigns SET priority = 1, status = 'PRODUCTION'
WHERE id = (SELECT id FROM campaigns LIMIT 1);

-- Test 2: Test qualification function with simple logic
SELECT evaluate_lead_qualification(
  (SELECT id FROM leads LIMIT 1),
  '{"rules": []}'::jsonb
); -- Should return TRUE

-- Test 3: Test assignment function
SELECT assign_lead_to_campaign(
  (SELECT id FROM leads WHERE campaign_id IS NULL LIMIT 1)
);

-- Test 4: Verify event was logged
SELECT * FROM lead_events
WHERE event_data->>'reason' = 'priority_assignment'
ORDER BY created_at DESC LIMIT 1;
```

---

## Task 3: Update TypeScript Types for Outreach State

### Description
Update the Lead TypeScript interface to include new outreach state fields and create related types.

### Context
Lead types are defined at `/Sales Pipeline Dashboard/src/types/lead.ts`. We need to add the new fields and create helper types for the outreach workflow.

### Files to Modify
- `/Sales Pipeline Dashboard/src/types/lead.ts`

### Files to Create
- `/Sales Pipeline Dashboard/src/types/outreach.ts`

### Implementation Details

**Edit `/Sales Pipeline Dashboard/src/types/lead.ts`:**
Add to the Lead interface:
```typescript
// Outreach state tracking (messaging lifecycle)
outreachState: OutreachState;
outreachStateChangedAt: string | null;
lastExportedAt: string | null;
exportCount: number;
salesNotes: string | null;
```

**Create `/Sales Pipeline Dashboard/src/types/outreach.ts`:**
```typescript
/**
 * Outreach State Types
 * Tracks the messaging lifecycle of a lead within a campaign
 */

export type OutreachState = 'new' | 'messaged' | 'skipped' | 'replied';

export interface OutreachStateInfo {
  state: OutreachState;
  label: string;
  color: string; // Tailwind class
  bgColor: string;
  description: string;
}

export const OUTREACH_STATES: Record<OutreachState, OutreachStateInfo> = {
  new: {
    state: 'new',
    label: 'New',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    description: 'Lead has not been messaged yet'
  },
  messaged: {
    state: 'messaged',
    label: 'Messaged',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    description: 'Outreach message has been sent'
  },
  skipped: {
    state: 'skipped',
    label: 'Skipped',
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
    description: 'Lead was intentionally excluded'
  },
  replied: {
    state: 'replied',
    label: 'Replied',
    color: 'text-[#E2D243]', // Brand gold
    bgColor: 'bg-[#E2D243]/10',
    description: 'Lead has responded to outreach'
  }
};

export interface ExportLog {
  id: string;
  campaignId: string;
  leadCount: number;
  leadIds: string[];
  exportedBy: string | null;
  exportedAt: string;
  exportFields: string[];
}

export interface CampaignLeadStats {
  total: number;
  new: number;
  messaged: number;
  skipped: number;
  replied: number;
  replyRate: number; // percentage
}

export interface BulkStateUpdateRequest {
  leadIds: string[];
  state: OutreachState;
}

export interface ExportRequest {
  campaignId: string;
  leadIds: string[];
  fields?: string[]; // If not provided, auto-detect from template
}

export interface ExportResponse {
  success: boolean;
  filename: string;
  leadCount: number;
  downloadUrl?: string;
  warnings?: string[]; // e.g., "3 leads were previously exported"
}
```

### MCP Tools to Use
1. `Read` to get current `/Sales Pipeline Dashboard/src/types/lead.ts`
2. `Edit` to add new fields to Lead interface
3. `Write` to create `/Sales Pipeline Dashboard/src/types/outreach.ts`
4. `mcp__supabase__generate_typescript_types` to regenerate database types

### Success Criteria
- [ ] Lead interface has outreachState and related fields
- [ ] OutreachState type exported
- [ ] OUTREACH_STATES constant with styling info
- [ ] ExportLog, CampaignLeadStats types defined
- [ ] No TypeScript errors

### Testing Steps
```bash
cd "/home/jeffl/projects/Integrated Sales Pipeline/Sales Pipeline Dashboard"
npx tsc --noEmit
```

---

## Task 4: Create Campaign Leads API Endpoint

### Description
Create API endpoint to fetch paginated leads for a campaign with filtering by outreach state.

### Context
API routes are in `/Sales Pipeline Dashboard/src/app/api/`. We need a new endpoint that returns leads belonging to a specific campaign with filtering and pagination support.

### Files to Create
- `/Sales Pipeline Dashboard/src/app/api/campaigns/[id]/leads/route.ts`

### Implementation Details

```typescript
// /src/app/api/campaigns/[id]/leads/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { OutreachState } from '@/types/outreach';

interface LeadQueryParams {
  state?: OutreachState;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const campaignId = params.id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get('state') as OutreachState | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const sort = searchParams.get('sort') || 'created_at';
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const search = searchParams.get('search');

    // Verify campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Build query
    let query = supabase
      .from('leads')
      .select(`
        id,
        twitter_handle,
        project_name,
        project_token,
        symbol,
        outreach_state,
        outreach_state_changed_at,
        last_exported_at,
        export_count,
        sales_notes,
        lead_score,
        lead_tier,
        follower_count,
        market_cap,
        created_at,
        updated_at
      `, { count: 'exact' })
      .eq('campaign_id', campaignId);

    // Apply state filter
    if (state) {
      query = query.eq('outreach_state', state);
    }

    // Apply search filter
    if (search) {
      query = query.or(`twitter_handle.ilike.%${search}%,project_name.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sort, { ascending: order === 'asc' });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: leads, error, count } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      );
    }

    // Get state counts for this campaign
    const { data: stateCounts } = await supabase
      .rpc('get_campaign_lead_counts', { p_campaign_id: campaignId });

    // Calculate stats
    const stats = {
      total: count || 0,
      new: stateCounts?.new || 0,
      messaged: stateCounts?.messaged || 0,
      skipped: stateCounts?.skipped || 0,
      replied: stateCounts?.replied || 0,
      replyRate: stateCounts?.messaged > 0
        ? Math.round((stateCounts?.replied / stateCounts?.messaged) * 100)
        : 0
    };

    return NextResponse.json({
      leads: leads || [],
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Campaign leads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Also create the RPC function for counts:**
```sql
-- Add to migration or execute directly
CREATE OR REPLACE FUNCTION get_campaign_lead_counts(p_campaign_id UUID)
RETURNS TABLE (
  new BIGINT,
  messaged BIGINT,
  skipped BIGINT,
  replied BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE outreach_state = 'new') as new,
    COUNT(*) FILTER (WHERE outreach_state = 'messaged') as messaged,
    COUNT(*) FILTER (WHERE outreach_state = 'skipped') as skipped,
    COUNT(*) FILTER (WHERE outreach_state = 'replied') as replied
  FROM leads
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;
```

### MCP Tools to Use
1. `Write` to create the route file
2. `mcp__supabase__execute_sql` to create the RPC function
3. `Bash` to test with curl

### Success Criteria
- [ ] GET /api/campaigns/[id]/leads returns paginated leads
- [ ] State filtering works
- [ ] Search filtering works
- [ ] Pagination metadata correct
- [ ] Stats object included in response

### Testing Steps
```bash
# After deployment, test with curl
curl "http://localhost:3000/api/campaigns/[CAMPAIGN_ID]/leads?state=new&limit=10"

# Test pagination
curl "http://localhost:3000/api/campaigns/[CAMPAIGN_ID]/leads?page=2&limit=25"

# Test search
curl "http://localhost:3000/api/campaigns/[CAMPAIGN_ID]/leads?search=bitcoin"
```

---

## Task 5: Create Bulk State Update API Endpoint

### Description
Create API endpoint to update outreach_state for multiple leads at once.

### Context
Sales needs to select multiple leads and mark them as messaged or skipped in bulk.

### Files to Create
- `/Sales Pipeline Dashboard/src/app/api/leads/bulk-update-state/route.ts`

### Implementation Details

```typescript
// /src/app/api/leads/bulk-update-state/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { OutreachState } from '@/types/outreach';

interface BulkUpdateRequest {
  leadIds: string[];
  state: OutreachState;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body: BulkUpdateRequest = await request.json();

    // Validate request
    if (!body.leadIds || !Array.isArray(body.leadIds) || body.leadIds.length === 0) {
      return NextResponse.json(
        { error: 'leadIds array is required' },
        { status: 400 }
      );
    }

    if (!body.state || !['new', 'messaged', 'skipped', 'replied'].includes(body.state)) {
      return NextResponse.json(
        { error: 'Valid state is required (new, messaged, skipped, replied)' },
        { status: 400 }
      );
    }

    // Limit batch size
    if (body.leadIds.length > 500) {
      return NextResponse.json(
        { error: 'Maximum 500 leads per batch' },
        { status: 400 }
      );
    }

    // Update leads
    const { data, error } = await supabase
      .from('leads')
      .update({
        outreach_state: body.state,
        outreach_state_changed_at: new Date().toISOString()
      })
      .in('id', body.leadIds)
      .select('id, outreach_state');

    if (error) {
      console.error('Bulk update error:', error);
      return NextResponse.json(
        { error: 'Failed to update leads' },
        { status: 500 }
      );
    }

    // Log bulk action to lead_events for each lead
    const events = body.leadIds.map(leadId => ({
      lead_id: leadId,
      event_type: 'stage_changed',
      event_data: {
        field: 'outreach_state',
        to: body.state,
        bulk_action: true,
        batch_size: body.leadIds.length
      },
      actor: 'user' // TODO: Get actual user from session
    }));

    await supabase.from('lead_events').insert(events);

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      state: body.state
    });
  } catch (error) {
    console.error('Bulk state update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### MCP Tools to Use
1. `Write` to create the route file
2. `Bash` to test with curl

### Success Criteria
- [ ] POST /api/leads/bulk-update-state updates multiple leads
- [ ] Validates leadIds array
- [ ] Validates state value
- [ ] Limits batch size to 500
- [ ] Events logged for each lead

### Testing Steps
```bash
# Test bulk update
curl -X POST "http://localhost:3000/api/leads/bulk-update-state" \
  -H "Content-Type: application/json" \
  -d '{"leadIds": ["uuid1", "uuid2"], "state": "messaged"}'
```

---

## Task 6: Create CSV Export API Endpoint

### Description
Create API endpoint to generate and download CSV exports of selected leads with template field auto-detection.

### Context
The spintax utility at `/Sales Pipeline Dashboard/src/lib/utils/spintax.ts` has `extractVariables()` function that can parse `{{field}}` from templates. We need to use this to auto-detect which fields to include in exports.

### Files to Create
- `/Sales Pipeline Dashboard/src/app/api/campaigns/[id]/leads/export/route.ts`
- `/Sales Pipeline Dashboard/src/lib/export/csv-generator.ts`

### Implementation Details

**Create `/Sales Pipeline Dashboard/src/lib/export/csv-generator.ts`:**
```typescript
import { Lead } from '@/types/lead';

// Map template variable names to lead field paths
const FIELD_MAPPINGS: Record<string, string> = {
  'name': 'project_name',
  'projectName': 'project_name',
  'project': 'project_name',
  'handle': 'twitter_handle',
  'twitterHandle': 'twitter_handle',
  'x': 'twitter_handle',
  'token': 'project_token',
  'symbol': 'symbol',
  'marketCap': 'market_cap',
  'followers': 'follower_count',
  'website': 'website',
  'telegram': 'telegram',
  'blockchain': 'blockchain',
  'founderName': 'founder_name',
  'founderTwitter': 'founder_twitter',
};

export function normalizeFieldName(templateVar: string): string {
  // Remove {{ and }} if present
  const cleaned = templateVar.replace(/\{\{|\}\}/g, '').trim();
  // Check mapping or return as-is (converted to snake_case)
  return FIELD_MAPPINGS[cleaned] || cleaned.replace(/([A-Z])/g, '_$1').toLowerCase();
}

export function getFieldValue(lead: Lead, fieldPath: string): string {
  // Handle nested paths like enrichment_data.some_field
  const parts = fieldPath.split('.');
  let value: unknown = lead;

  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      value = undefined;
      break;
    }
  }

  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function generateCSV(leads: Lead[], fields: string[]): string {
  // Header row
  const headers = fields.map(f => `"${f}"`).join(',');

  // Data rows
  const rows = leads.map(lead => {
    return fields.map(field => {
      const value = getFieldValue(lead, normalizeFieldName(field));
      // Escape quotes and wrap in quotes
      return `"${value.replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headers, ...rows].join('\n');
}

export function getDefaultExportFields(): string[] {
  return ['twitter_handle', 'project_name', 'symbol', 'lead_score'];
}
```

**Create `/Sales Pipeline Dashboard/src/app/api/campaigns/[id]/leads/export/route.ts`:**
```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { extractVariables } from '@/lib/utils/spintax';
import { generateCSV, normalizeFieldName, getDefaultExportFields } from '@/lib/export/csv-generator';

interface ExportRequest {
  leadIds: string[];
  fields?: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const campaignId = params.id;
    const body: ExportRequest = await request.json();

    // Validate request
    if (!body.leadIds || body.leadIds.length === 0) {
      return NextResponse.json(
        { error: 'leadIds array is required' },
        { status: 400 }
      );
    }

    // Get campaign to extract template variables
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, messaging_template')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Determine fields to export
    let exportFields = body.fields;
    if (!exportFields || exportFields.length === 0) {
      if (campaign.messaging_template) {
        // Auto-detect from template
        const templateVars = extractVariables(campaign.messaging_template);
        exportFields = ['twitter_handle', ...templateVars.map(normalizeFieldName)];
        // Dedupe
        exportFields = [...new Set(exportFields)];
      } else {
        exportFields = getDefaultExportFields();
      }
    }

    // Fetch leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .in('id', body.leadIds)
      .eq('campaign_id', campaignId);

    if (leadsError) {
      console.error('Error fetching leads for export:', leadsError);
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      );
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json(
        { error: 'No leads found' },
        { status: 404 }
      );
    }

    // Check for previously exported leads
    const previouslyExported = leads.filter(l => l.export_count > 0);
    const warnings: string[] = [];
    if (previouslyExported.length > 0) {
      warnings.push(`${previouslyExported.length} lead(s) were previously exported`);
    }

    // Generate CSV
    const csv = generateCSV(leads, exportFields);

    // Update export tracking on leads
    await supabase
      .from('leads')
      .update({
        last_exported_at: new Date().toISOString(),
        export_count: supabase.rpc('increment_export_count')
      })
      .in('id', body.leadIds);

    // Simpler approach - just increment directly
    for (const leadId of body.leadIds) {
      await supabase.rpc('increment_lead_export_count', { p_lead_id: leadId });
    }

    // Log export
    await supabase.from('export_logs').insert({
      campaign_id: campaignId,
      lead_count: leads.length,
      lead_ids: body.leadIds,
      exported_by: null, // TODO: Get from session
      export_fields: exportFields
    });

    // Return CSV as downloadable file
    const filename = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_leads_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Warnings': JSON.stringify(warnings),
        'X-Export-Count': String(leads.length)
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Add helper RPC function:**
```sql
CREATE OR REPLACE FUNCTION increment_lead_export_count(p_lead_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE leads
  SET
    export_count = COALESCE(export_count, 0) + 1,
    last_exported_at = NOW()
  WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;
```

### MCP Tools to Use
1. `Read` to check existing spintax.ts for extractVariables function
2. `Write` to create csv-generator.ts
3. `Write` to create export route
4. `mcp__supabase__execute_sql` to create RPC function
5. `Bash` to test

### Success Criteria
- [ ] POST /api/campaigns/[id]/leads/export returns CSV file
- [ ] Template variables auto-detected
- [ ] Warnings included for re-exported leads
- [ ] Export logged to export_logs table
- [ ] Lead export_count incremented

### Testing Steps
```bash
# Test export
curl -X POST "http://localhost:3000/api/campaigns/[ID]/leads/export" \
  -H "Content-Type: application/json" \
  -d '{"leadIds": ["uuid1"]}' \
  --output test_export.csv

# Verify CSV contents
cat test_export.csv
```

---

## Task 7: Create Lead Notes API Endpoint

### Description
Create API endpoint to update sales notes on a lead.

### Files to Create
- `/Sales Pipeline Dashboard/src/app/api/leads/[id]/notes/route.ts`

### Implementation Details

```typescript
// /src/app/api/leads/[id]/notes/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const leadId = params.id;
    const { notes } = await request.json();

    if (typeof notes !== 'string') {
      return NextResponse.json(
        { error: 'notes must be a string' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('leads')
      .update({ sales_notes: notes })
      .eq('id', leadId)
      .select('id, sales_notes')
      .single();

    if (error) {
      console.error('Notes update error:', error);
      return NextResponse.json(
        { error: 'Failed to update notes' },
        { status: 500 }
      );
    }

    // Log note update
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'note_added',
      event_data: { notes_length: notes.length },
      actor: 'user'
    });

    return NextResponse.json({ success: true, lead: data });
  } catch (error) {
    console.error('Notes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const leadId = params.id;

    const { data, error } = await supabase
      .from('leads')
      .select('id, sales_notes')
      .eq('id', leadId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ notes: data.sales_notes });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### MCP Tools to Use
1. `Write` to create the route file

### Success Criteria
- [ ] PATCH /api/leads/[id]/notes updates notes
- [ ] GET /api/leads/[id]/notes retrieves notes
- [ ] Event logged on note update

### Testing Steps
```bash
curl -X PATCH "http://localhost:3000/api/leads/[ID]/notes" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Test note content"}'
```

---

## Task 8: Create InboxApp Webhook Endpoint

### Description
Create webhook endpoint to receive reply events from InboxApp and auto-update lead states.

### Context
InboxApp webhook docs:
- https://inboxapp.com/docs/webhooks/webhooks
- https://inboxapp.com/docs/webhooks/schema
- https://inboxapp.com/docs/webhooks/external-user

### Files to Create
- `/Sales Pipeline Dashboard/src/app/api/webhooks/inboxapp/route.ts`
- `/Sales Pipeline Dashboard/src/lib/integrations/inboxapp.ts`

### Implementation Details

**Create `/Sales Pipeline Dashboard/src/lib/integrations/inboxapp.ts`:**
```typescript
/**
 * InboxApp Integration
 * Handles webhook verification and event processing
 */

export interface InboxAppWebhookEvent {
  event_type: 'message_sent' | 'reply_received' | 'conversation_started' | 'dm_received';
  timestamp: string;
  conversation_id: string;
  external_user: {
    id: string;
    username: string; // Twitter handle
    display_name?: string;
    profile_url?: string;
  };
  message?: {
    id: string;
    text: string;
    sent_at: string;
    direction: 'inbound' | 'outbound';
  };
}

export interface InboxAppWebhookPayload {
  webhook_id: string;
  events: InboxAppWebhookEvent[];
}

export function verifyInboxAppSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // InboxApp uses HMAC-SHA256 for webhook signatures
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export function extractTwitterHandle(externalUser: InboxAppWebhookEvent['external_user']): string | null {
  // Username should be the Twitter handle
  if (externalUser.username) {
    // Remove @ if present
    return externalUser.username.replace(/^@/, '').toLowerCase();
  }
  return null;
}
```

**Create `/Sales Pipeline Dashboard/src/app/api/webhooks/inboxapp/route.ts`:**
```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  InboxAppWebhookPayload,
  InboxAppWebhookEvent,
  verifyInboxAppSignature,
  extractTwitterHandle
} from '@/lib/integrations/inboxapp';

const INBOXAPP_WEBHOOK_SECRET = process.env.INBOXAPP_WEBHOOK_SECRET;

// Map InboxApp event types to our outreach states
const EVENT_TO_STATE: Record<string, 'messaged' | 'replied'> = {
  'target_contacted': 'messaged',
  'target_replied': 'replied',
  // Legacy/alternative event names
  'reply_received': 'replied',
  'dm_received': 'replied',
  'message_sent': 'messaged',
};

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-inboxapp-signature') || '';

    // Verify signature (skip in development if secret not set)
    if (INBOXAPP_WEBHOOK_SECRET) {
      if (!verifyInboxAppSignature(rawBody, signature, INBOXAPP_WEBHOOK_SECRET)) {
        console.error('InboxApp webhook signature verification failed');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const payload: InboxAppWebhookPayload = JSON.parse(rawBody);
    const supabase = createClient();

    let processedCount = 0;
    let errorCount = 0;
    const results: { handle: string; event: string; newState: string; success: boolean }[] = [];

    for (const event of payload.events) {
      try {
        // Determine target state from event type
        const targetState = EVENT_TO_STATE[event.event_type];
        if (!targetState) {
          console.log(`Ignoring unhandled event type: ${event.event_type}`);
          continue;
        }

        // Extract Twitter handle
        const twitterHandle = extractTwitterHandle(event.external_user);
        if (!twitterHandle) {
          console.warn('InboxApp event missing twitter handle:', event);
          continue;
        }

        // Find lead by twitter handle
        const { data: lead, error: findError } = await supabase
          .from('leads')
          .select('id, campaign_id, outreach_state')
          .eq('twitter_handle', twitterHandle)
          .single();

        if (findError || !lead) {
          console.warn(`Lead not found for handle: ${twitterHandle}`);
          results.push({ handle: twitterHandle, event: event.event_type, newState: targetState, success: false });
          continue;
        }

        // Validate state transition
        // For 'messaged': only update if currently 'new'
        // For 'replied': only update if currently 'messaged'
        const validTransitions: Record<string, string[]> = {
          'messaged': ['new'],
          'replied': ['messaged'],
        };

        if (!validTransitions[targetState].includes(lead.outreach_state)) {
          console.log(`Lead ${twitterHandle} in '${lead.outreach_state}' state, cannot transition to '${targetState}'`);
          continue;
        }

        // Update state
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            outreach_state: targetState,
            outreach_state_changed_at: new Date().toISOString()
          })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Failed to update lead ${lead.id}:`, updateError);
          errorCount++;
          results.push({ handle: twitterHandle, event: event.event_type, newState: targetState, success: false });
          continue;
        }

        // Log the event
        const eventType = targetState === 'replied' ? 'reply_received' : 'message_sent';
        await supabase.from('lead_events').insert({
          lead_id: lead.id,
          event_type: eventType,
          event_data: {
            source: 'inboxapp',
            inboxapp_event: event.event_type,
            conversation_id: event.conversation_id,
            message_preview: event.message?.text?.substring(0, 100),
            event_timestamp: event.message?.sent_at || event.timestamp
          },
          actor: 'inboxapp_webhook'
        });

        processedCount++;
        results.push({ handle: twitterHandle, event: event.event_type, newState: targetState, success: true });
        console.log(`Updated lead ${twitterHandle} to '${targetState}' state via ${event.event_type}`);

      } catch (eventError) {
        console.error('Error processing InboxApp event:', eventError);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errorCount,
      results
    });
  } catch (error) {
    console.error('InboxApp webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle webhook verification/challenge
export async function GET(request: NextRequest) {
  // Some webhook providers send a challenge on registration
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return new NextResponse(challenge);
  }

  return NextResponse.json({
    status: 'InboxApp webhook endpoint active',
    supported_events: ['target_contacted', 'target_replied'],
    timestamp: new Date().toISOString()
  });
}
```

### MCP Tools to Use
1. `Write` to create both files
2. After deployment, the webhook URL needs to be registered in InboxApp dashboard

### Success Criteria
- [ ] POST /api/webhooks/inboxapp processes events
- [ ] Signature verification works
- [ ] Leads found by twitter_handle
- [ ] State updated to 'replied'
- [ ] Events logged with message preview

### Testing Steps
```bash
# Test with mock webhook payload
curl -X POST "http://localhost:3000/api/webhooks/inboxapp" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_id": "test",
    "events": [{
      "event_type": "reply_received",
      "timestamp": "2026-01-21T12:00:00Z",
      "conversation_id": "conv123",
      "external_user": {
        "id": "user123",
        "username": "test_handle"
      },
      "message": {
        "id": "msg123",
        "text": "Thanks for reaching out!",
        "sent_at": "2026-01-21T12:00:00Z",
        "direction": "inbound"
      }
    }]
  }'
```

---

## Task 9: Create Lead State Badge Component

### Description
Create a reusable badge component to display lead outreach state with consistent styling.

### Context
Brand colors from `/home/jeffl/projects/Integrated Sales Pipeline/.claude/rules/brand-compliance.md`:
- Navy: #0A0724
- Gold: #E2D243 (for Replied state - most important)
- Light Grey: #F2F2F2
- White: #FFFFFF
- Black: #000000

### Files to Create
- `/Sales Pipeline Dashboard/src/components/leads/lead-state-badge.tsx`

### Implementation Details

```typescript
// /src/components/leads/lead-state-badge.tsx
'use client';

import { OutreachState, OUTREACH_STATES } from '@/types/outreach';
import { cn } from '@/lib/utils';

interface LeadStateBadgeProps {
  state: OutreachState;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5'
};

export function LeadStateBadge({
  state,
  size = 'md',
  showDot = true,
  className
}: LeadStateBadgeProps) {
  const stateInfo = OUTREACH_STATES[state];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-medium',
        stateInfo.bgColor,
        stateInfo.color,
        sizeClasses[size],
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            state === 'new' && 'bg-blue-400',
            state === 'messaged' && 'bg-green-400',
            state === 'skipped' && 'bg-gray-400',
            state === 'replied' && 'bg-[#E2D243]'
          )}
        />
      )}
      {stateInfo.label}
    </span>
  );
}

// Compact version for table cells
export function LeadStateDot({ state }: { state: OutreachState }) {
  const stateInfo = OUTREACH_STATES[state];

  return (
    <span
      className="relative flex h-2.5 w-2.5"
      title={stateInfo.description}
    >
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75',
          state === 'new' && 'bg-blue-400 animate-pulse',
          state === 'messaged' && 'bg-green-400',
          state === 'skipped' && 'bg-gray-400',
          state === 'replied' && 'bg-[#E2D243]'
        )}
      />
      <span
        className={cn(
          'relative inline-flex rounded-full h-2.5 w-2.5',
          state === 'new' && 'bg-blue-500',
          state === 'messaged' && 'bg-green-500',
          state === 'skipped' && 'bg-gray-500',
          state === 'replied' && 'bg-[#E2D243]'
        )}
      />
    </span>
  );
}
```

### MCP Tools to Use
1. `Write` to create the component file

### Success Criteria
- [ ] Badge displays correct color per state
- [ ] Size variants work
- [ ] Dot indicator included
- [ ] Brand gold (#E2D243) used for replied state
- [ ] Accessible with title/tooltip

### Testing Steps
```bash
# Build check
cd "/home/jeffl/projects/Integrated Sales Pipeline/Sales Pipeline Dashboard"
npx tsc --noEmit
```

---

## Task 10: Create Lead Table Component

### Description
Create the main table component for displaying leads within a campaign.

### Context
This is the primary view for sales to see and interact with leads. Must support:
- Sortable columns
- Row selection for bulk actions
- State filtering
- Pagination
- Real-time updates

### Files to Create
- `/Sales Pipeline Dashboard/src/components/leads/lead-table.tsx`
- `/Sales Pipeline Dashboard/src/components/leads/lead-table-columns.tsx`

### Implementation Details

**Create `/Sales Pipeline Dashboard/src/components/leads/lead-table-columns.tsx`:**
```typescript
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Lead } from '@/types/lead';
import { LeadStateBadge } from './lead-state-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ExternalLink, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ColumnOptions {
  onViewDetails: (lead: Lead) => void;
  onSkip: (lead: Lead) => void;
}

export function createLeadColumns(options: ColumnOptions): ColumnDef<Lead>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'twitter_handle',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[#F2F2F2] hover:text-white"
        >
          X Handle
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const handle = row.getValue('twitter_handle') as string;
        return (
          <a
            href={`https://x.com/${handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#E2D243] hover:underline"
          >
            @{handle}
            <ExternalLink className="h-3 w-3" />
          </a>
        );
      },
    },
    {
      accessorKey: 'project_name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[#F2F2F2] hover:text-white"
        >
          Company/Project
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-white font-medium">
          {row.getValue('project_name') || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'outreach_state',
      header: 'State',
      cell: ({ row }) => (
        <LeadStateBadge state={row.getValue('outreach_state')} size="sm" />
      ),
    },
    {
      accessorKey: 'lead_score',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[#F2F2F2] hover:text-white"
        >
          Score
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const score = row.getValue('lead_score') as number | null;
        return (
          <span className="text-[#F2F2F2]">
            {score !== null ? score : '-'}
          </span>
        );
      },
    },
    {
      accessorKey: 'follower_count',
      header: 'Followers',
      cell: ({ row }) => {
        const count = row.getValue('follower_count') as number | null;
        return (
          <span className="text-[#F2F2F2]">
            {count !== null ? count.toLocaleString() : '-'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black border-[#F2F2F2]/20">
              <DropdownMenuItem
                onClick={() => options.onViewDetails(lead)}
                className="text-white hover:bg-[#E2D243]/10"
              >
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => options.onSkip(lead)}
                className="text-white hover:bg-[#E2D243]/10"
              >
                Skip Lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
```

**Create `/Sales Pipeline Dashboard/src/components/leads/lead-table.tsx`:**
```typescript
'use client';

import { useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
} from '@tanstack/react-table';
import { Lead } from '@/types/lead';
import { OutreachState, CampaignLeadStats } from '@/types/outreach';
import { createLeadColumns } from './lead-table-columns';
import { LeadTableActions } from './lead-table-actions';
import { LeadTableFilters } from './lead-table-filters';
import { LeadDetailPanel } from './lead-detail-panel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LeadTableProps {
  campaignId: string;
  campaignName: string;
}

export function LeadTable({ campaignId, campaignName }: LeadTableProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<CampaignLeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [stateFilter, setStateFilter] = useState<OutreachState | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
      });
      if (stateFilter !== 'all') {
        params.set('state', stateFilter);
      }
      if (sorting.length > 0) {
        params.set('sort', sorting[0].id);
        params.set('order', sorting[0].desc ? 'desc' : 'asc');
      }

      const response = await fetch(`/api/campaigns/${campaignId}/leads?${params}`);
      const data = await response.json();

      setLeads(data.leads);
      setStats(data.stats);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [campaignId, page, stateFilter, sorting]);

  const handleSkip = async (lead: Lead) => {
    try {
      await fetch('/api/leads/bulk-update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [lead.id], state: 'skipped' }),
      });
      fetchLeads();
    } catch (error) {
      console.error('Failed to skip lead:', error);
    }
  };

  const columns = createLeadColumns({
    onViewDetails: setSelectedLead,
    onSkip: handleSkip,
  });

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  const selectedLeadIds = Object.keys(rowSelection)
    .filter(key => rowSelection[key as keyof typeof rowSelection])
    .map(index => leads[parseInt(index)]?.id)
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {stats && (
        <div className="flex gap-4 text-sm">
          <span className="text-[#F2F2F2]">Total: <strong className="text-white">{stats.total}</strong></span>
          <span className="text-blue-400">New: {stats.new}</span>
          <span className="text-green-400">Messaged: {stats.messaged}</span>
          <span className="text-gray-400">Skipped: {stats.skipped}</span>
          <span className="text-[#E2D243]">Replied: {stats.replied}</span>
          <span className="text-[#F2F2F2]">Reply Rate: <strong className="text-[#E2D243]">{stats.replyRate}%</strong></span>
        </div>
      )}

      {/* Filters and actions */}
      <div className="flex justify-between items-center">
        <LeadTableFilters
          currentFilter={stateFilter}
          onFilterChange={setStateFilter}
          stats={stats}
        />
        <LeadTableActions
          selectedIds={selectedLeadIds}
          campaignId={campaignId}
          onActionComplete={() => {
            setRowSelection({});
            fetchLeads();
          }}
        />
      </div>

      {/* Table */}
      <div className="rounded border border-[#F2F2F2]/20 bg-black">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="border-[#F2F2F2]/20 hover:bg-transparent">
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id} className="text-[#F2F2F2]">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-[#F2F2F2]">
                  Loading...
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-[#F2F2F2]">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  className="border-[#F2F2F2]/20 hover:bg-[#E2D243]/5 cursor-pointer"
                  onClick={() => setSelectedLead(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-[#F2F2F2]">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-[#F2F2F2]/20 text-[#F2F2F2]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-[#F2F2F2]/20 text-[#F2F2F2]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={fetchLeads}
        />
      )}
    </div>
  );
}
```

### MCP Tools to Use
1. `Write` to create both files
2. `Bash` to check for TypeScript errors

### Success Criteria
- [ ] Table renders with all columns
- [ ] Sorting works on sortable columns
- [ ] Row selection works
- [ ] Click row opens detail panel
- [ ] Pagination controls work
- [ ] Stats bar shows correct counts
- [ ] Brand colors applied correctly

### Testing Steps
```bash
cd "/home/jeffl/projects/Integrated Sales Pipeline/Sales Pipeline Dashboard"
npx tsc --noEmit
npm run build
```

---

## Task 11: Create Lead Table Actions Component

### Description
Create the bulk action toolbar for the lead table.

### Files to Create
- `/Sales Pipeline Dashboard/src/components/leads/lead-table-actions.tsx`

### Implementation Details

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface LeadTableActionsProps {
  selectedIds: string[];
  campaignId: string;
  onActionComplete: () => void;
}

export function LeadTableActions({
  selectedIds,
  campaignId,
  onActionComplete
}: LeadTableActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);

  const hasSelection = selectedIds.length > 0;

  const handleExport = async () => {
    setLoading('export');
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/leads/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedIds }),
      });

      // Check for warnings
      const warnings = response.headers.get('X-Export-Warnings');
      if (warnings) {
        const parsedWarnings = JSON.parse(warnings);
        if (parsedWarnings.length > 0) {
          setExportWarnings(parsedWarnings);
          setShowExportWarning(true);
          setLoading(null);
          return;
        }
      }

      // Download CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'leads.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onActionComplete();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(null);
    }
  };

  const proceedWithExport = async () => {
    setShowExportWarning(false);
    // Re-trigger export, user confirmed
    await handleExport();
  };

  const handleMarkMessaged = async () => {
    setLoading('messaged');
    try {
      await fetch('/api/leads/bulk-update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedIds, state: 'messaged' }),
      });
      onActionComplete();
    } catch (error) {
      console.error('Mark messaged failed:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleMarkSkipped = async () => {
    setLoading('skipped');
    try {
      await fetch('/api/leads/bulk-update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedIds, state: 'skipped' }),
      });
      onActionComplete();
    } catch (error) {
      console.error('Mark skipped failed:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {hasSelection && (
          <span className="text-sm text-[#F2F2F2] mr-2">
            {selectedIds.length} selected
          </span>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={!hasSelection || loading !== null}
          className="border-[#E2D243] text-[#E2D243] hover:bg-[#E2D243]/10"
        >
          {loading === 'export' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export CSV
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkMessaged}
          disabled={!hasSelection || loading !== null}
          className="border-green-500 text-green-500 hover:bg-green-500/10"
        >
          {loading === 'messaged' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Mark Messaged
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkSkipped}
          disabled={!hasSelection || loading !== null}
          className="border-gray-500 text-gray-500 hover:bg-gray-500/10"
        >
          {loading === 'skipped' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4 mr-2" />
          )}
          Skip
        </Button>
      </div>

      <AlertDialog open={showExportWarning} onOpenChange={setShowExportWarning}>
        <AlertDialogContent className="bg-black border-[#F2F2F2]/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Export Warning</AlertDialogTitle>
            <AlertDialogDescription className="text-[#F2F2F2]">
              {exportWarnings.map((warning, i) => (
                <p key={i}>{warning}</p>
              ))}
              <p className="mt-2">Do you want to proceed with the export?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#F2F2F2]/20 text-[#F2F2F2]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={proceedWithExport}
              className="bg-[#E2D243] text-black hover:bg-[#E2D243]/90"
            >
              Export Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### MCP Tools to Use
1. `Write` to create the component

### Success Criteria
- [ ] Export button triggers CSV download
- [ ] Mark Messaged updates selected leads
- [ ] Skip button updates selected leads
- [ ] Loading states shown during operations
- [ ] Warning dialog for re-exports
- [ ] Selection count displayed

---

## Task 12: Create Lead Table Filters Component

### Description
Create the state filter dropdown for the lead table.

### Files to Create
- `/Sales Pipeline Dashboard/src/components/leads/lead-table-filters.tsx`

### Implementation Details

```typescript
'use client';

import { OutreachState, OUTREACH_STATES, CampaignLeadStats } from '@/types/outreach';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LeadTableFiltersProps {
  currentFilter: OutreachState | 'all';
  onFilterChange: (filter: OutreachState | 'all') => void;
  stats: CampaignLeadStats | null;
}

export function LeadTableFilters({
  currentFilter,
  onFilterChange,
  stats
}: LeadTableFiltersProps) {
  return (
    <div className="flex items-center gap-4">
      <Select value={currentFilter} onValueChange={onFilterChange}>
        <SelectTrigger className="w-[180px] bg-black border-[#F2F2F2]/20 text-white">
          <SelectValue placeholder="Filter by state" />
        </SelectTrigger>
        <SelectContent className="bg-black border-[#F2F2F2]/20">
          <SelectItem value="all" className="text-white hover:bg-[#E2D243]/10">
            All States {stats && `(${stats.total})`}
          </SelectItem>
          {(Object.keys(OUTREACH_STATES) as OutreachState[]).map(state => {
            const stateInfo = OUTREACH_STATES[state];
            const count = stats ? stats[state] : 0;
            return (
              <SelectItem
                key={state}
                value={state}
                className="text-white hover:bg-[#E2D243]/10"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      state === 'new' ? 'bg-blue-400' :
                      state === 'messaged' ? 'bg-green-400' :
                      state === 'skipped' ? 'bg-gray-400' :
                      'bg-[#E2D243]'
                    }`}
                  />
                  {stateInfo.label} ({count})
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
```

### MCP Tools to Use
1. `Write` to create the component

### Success Criteria
- [ ] Dropdown shows all state options
- [ ] Counts displayed next to each option
- [ ] Filter change triggers parent callback
- [ ] Brand styling applied

---

## Task 13: Create Lead Detail Panel Component

### Description
Create the slide-over panel for viewing and editing lead details.

### Files to Create
- `/Sales Pipeline Dashboard/src/components/leads/lead-detail-panel.tsx`
- `/Sales Pipeline Dashboard/src/components/leads/lead-notes-editor.tsx`

### Implementation Details

**Create `/Sales Pipeline Dashboard/src/components/leads/lead-notes-editor.tsx`:**
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check } from 'lucide-react';
import debounce from 'lodash/debounce';

interface LeadNotesEditorProps {
  leadId: string;
  initialNotes: string | null;
}

export function LeadNotesEditor({ leadId, initialNotes }: LeadNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveNotes = useCallback(
    debounce(async (value: string) => {
      setSaving(true);
      setSaved(false);
      try {
        await fetch(`/api/leads/${leadId}/notes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: value }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (error) {
        console.error('Failed to save notes:', error);
      } finally {
        setSaving(false);
      }
    }, 1000),
    [leadId]
  );

  const handleChange = (value: string) => {
    setNotes(value);
    saveNotes(value);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#F2F2F2]">Sales Notes</label>
        {saving && (
          <span className="text-xs text-[#F2F2F2] flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </span>
        )}
        {saved && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Add notes about this lead..."
        className="min-h-[120px] bg-black border-[#F2F2F2]/20 text-white placeholder:text-[#F2F2F2]/50"
      />
    </div>
  );
}
```

**Create `/Sales Pipeline Dashboard/src/components/leads/lead-detail-panel.tsx`:**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Lead } from '@/types/lead';
import { LeadStateBadge } from './lead-state-badge';
import { LeadNotesEditor } from './lead-notes-editor';
import { LeadActivityTimeline } from './lead-activity-timeline';
import { OutreachState, OUTREACH_STATES } from '@/types/outreach';
import { Button } from '@/components/ui/button';
import { X, ExternalLink, ChevronDown } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LeadDetailPanelProps {
  lead: Lead;
  onClose: () => void;
  onUpdate: () => void;
}

export function LeadDetailPanel({ lead, onClose, onUpdate }: LeadDetailPanelProps) {
  const [currentState, setCurrentState] = useState<OutreachState>(lead.outreachState || 'new');
  const [updating, setUpdating] = useState(false);

  const handleStateChange = async (newState: OutreachState) => {
    setUpdating(true);
    try {
      await fetch('/api/leads/bulk-update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [lead.id], state: newState }),
      });
      setCurrentState(newState);
      onUpdate();
    } catch (error) {
      console.error('Failed to update state:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-[500px] bg-[#0A0724] border-l border-[#F2F2F2]/20 overflow-y-auto">
        <SheetHeader className="border-b border-[#F2F2F2]/20 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white">Lead Details</SheetTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Profile Section */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <a
                  href={`https://x.com/${lead.twitterHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-semibold text-[#E2D243] hover:underline flex items-center gap-2"
                >
                  @{lead.twitterHandle}
                  <ExternalLink className="h-4 w-4" />
                </a>
                <p className="text-[#F2F2F2]">{lead.projectName || 'Unknown Project'}</p>
              </div>

              {/* State changer */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updating}
                    className="border-[#F2F2F2]/20"
                  >
                    <LeadStateBadge state={currentState} size="sm" />
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-black border-[#F2F2F2]/20">
                  {(Object.keys(OUTREACH_STATES) as OutreachState[]).map(state => (
                    <DropdownMenuItem
                      key={state}
                      onClick={() => handleStateChange(state)}
                      className="text-white hover:bg-[#E2D243]/10"
                    >
                      <LeadStateBadge state={state} size="sm" />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black rounded p-3 border border-[#F2F2F2]/10">
                <p className="text-xs text-[#F2F2F2]">Lead Score</p>
                <p className="text-lg font-semibold text-white">{lead.leadScore ?? '-'}</p>
              </div>
              <div className="bg-black rounded p-3 border border-[#F2F2F2]/10">
                <p className="text-xs text-[#F2F2F2]">Followers</p>
                <p className="text-lg font-semibold text-white">
                  {lead.followerCount?.toLocaleString() ?? '-'}
                </p>
              </div>
              <div className="bg-black rounded p-3 border border-[#F2F2F2]/10">
                <p className="text-xs text-[#F2F2F2]">Symbol</p>
                <p className="text-lg font-semibold text-white">{lead.symbol || '-'}</p>
              </div>
              <div className="bg-black rounded p-3 border border-[#F2F2F2]/10">
                <p className="text-xs text-[#F2F2F2]">Market Cap</p>
                <p className="text-lg font-semibold text-white">
                  {lead.marketCap ? `$${(lead.marketCap / 1000000).toFixed(1)}M` : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <LeadNotesEditor leadId={lead.id} initialNotes={lead.salesNotes} />

          {/* Activity Timeline */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[#F2F2F2]">Activity History</h3>
            <div className="max-h-[300px] overflow-y-auto">
              <LeadActivityTimeline leadId={lead.id} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### MCP Tools to Use
1. `Write` to create both files
2. Check existing `LeadActivityTimeline` component at `/Sales Pipeline Dashboard/src/components/leads/lead-activity-timeline.tsx`

### Success Criteria
- [ ] Panel slides in from right
- [ ] Profile data displayed
- [ ] State dropdown allows changes
- [ ] Notes auto-save with debounce
- [ ] Activity timeline renders
- [ ] Brand colors and styling correct

---

## Task 14: Create Campaign Detail Page with Tabs

### Description
Create the campaign detail page with tabbed navigation for Overview, Leads, History, and Settings.

### Files to Create
- `/Sales Pipeline Dashboard/src/app/campaigns/[id]/page.tsx`
- `/Sales Pipeline Dashboard/src/components/campaigns/campaign-tabs.tsx`
- `/Sales Pipeline Dashboard/src/components/campaigns/campaign-stats-cards.tsx`
- `/Sales Pipeline Dashboard/src/components/campaigns/campaign-history.tsx`

### Implementation Details

**Create `/Sales Pipeline Dashboard/src/components/campaigns/campaign-stats-cards.tsx`:**
```typescript
'use client';

import { CampaignLeadStats } from '@/types/outreach';

interface CampaignStatsCardsProps {
  stats: CampaignLeadStats;
}

export function CampaignStatsCards({ stats }: CampaignStatsCardsProps) {
  const cards = [
    { label: 'Total Leads', value: stats.total, color: 'text-white' },
    { label: 'New', value: stats.new, color: 'text-blue-400' },
    { label: 'Messaged', value: stats.messaged, color: 'text-green-400' },
    { label: 'Skipped', value: stats.skipped, color: 'text-gray-400' },
    { label: 'Replied', value: stats.replied, color: 'text-[#E2D243]' },
    { label: 'Reply Rate', value: `${stats.replyRate}%`, color: 'text-[#E2D243]', highlight: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map(card => (
        <div
          key={card.label}
          className={`bg-black rounded-lg p-4 border ${
            card.highlight ? 'border-[#E2D243]' : 'border-[#F2F2F2]/10'
          }`}
        >
          <p className="text-xs text-[#F2F2F2] uppercase tracking-wide">{card.label}</p>
          <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
```

**Create `/Sales Pipeline Dashboard/src/components/campaigns/campaign-history.tsx`:**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { ExportLog } from '@/types/outreach';
import { format } from 'date-fns';

interface CampaignHistoryProps {
  campaignId: string;
}

export function CampaignHistory({ campaignId }: CampaignHistoryProps) {
  const [exports, setExports] = useState<ExportLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExports() {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/exports`);
        const data = await response.json();
        setExports(data.exports || []);
      } catch (error) {
        console.error('Failed to fetch exports:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchExports();
  }, [campaignId]);

  if (loading) {
    return <div className="text-[#F2F2F2]">Loading history...</div>;
  }

  if (exports.length === 0) {
    return <div className="text-[#F2F2F2]">No export history yet.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Export History</h3>
      <div className="space-y-2">
        {exports.map(exp => (
          <div
            key={exp.id}
            className="bg-black rounded p-4 border border-[#F2F2F2]/10"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white font-medium">
                  {exp.leadCount} leads exported
                </p>
                <p className="text-sm text-[#F2F2F2]">
                  Fields: {exp.exportFields.join(', ')}
                </p>
              </div>
              <p className="text-sm text-[#F2F2F2]">
                {format(new Date(exp.exportedAt), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Create `/Sales Pipeline Dashboard/src/components/campaigns/campaign-tabs.tsx`:**
```typescript
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadTable } from '@/components/leads/lead-table';
import { CampaignStatsCards } from './campaign-stats-cards';
import { CampaignHistory } from './campaign-history';
import { Campaign } from '@/types/campaign';
import { CampaignLeadStats } from '@/types/outreach';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

interface CampaignTabsProps {
  campaign: Campaign;
  stats: CampaignLeadStats;
}

export function CampaignTabs({ campaign, stats }: CampaignTabsProps) {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="bg-black border border-[#F2F2F2]/20">
        <TabsTrigger
          value="overview"
          className="data-[state=active]:bg-[#E2D243] data-[state=active]:text-black"
        >
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="leads"
          className="data-[state=active]:bg-[#E2D243] data-[state=active]:text-black"
        >
          Leads
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="data-[state=active]:bg-[#E2D243] data-[state=active]:text-black"
        >
          History
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          className="data-[state=active]:bg-[#E2D243] data-[state=active]:text-black"
        >
          Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <CampaignStatsCards stats={stats} />
        {/* Quick preview of recent leads */}
        <div className="bg-black rounded-lg p-4 border border-[#F2F2F2]/10">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <p className="text-[#F2F2F2]">
            {stats.new} new leads ready for outreach. {stats.replied} replies received.
          </p>
        </div>
      </TabsContent>

      <TabsContent value="leads">
        <LeadTable campaignId={campaign.id} campaignName={campaign.name} />
      </TabsContent>

      <TabsContent value="history">
        <CampaignHistory campaignId={campaign.id} />
      </TabsContent>

      <TabsContent value="settings">
        <div className="bg-black rounded-lg p-6 border border-[#F2F2F2]/10">
          <h3 className="text-lg font-semibold text-white mb-4">Campaign Settings</h3>
          <p className="text-[#F2F2F2] mb-4">
            Configure campaign targeting, messaging templates, and qualification rules.
          </p>
          <Link href={`/config/${campaign.id}`}>
            <Button className="bg-[#E2D243] text-black hover:bg-[#E2D243]/90">
              <Settings className="h-4 w-4 mr-2" />
              Open Campaign Configurator
            </Button>
          </Link>
        </div>
      </TabsContent>
    </Tabs>
  );
}
```

**Create `/Sales Pipeline Dashboard/src/app/campaigns/[id]/page.tsx`:**
```typescript
import { createClient } from '@/lib/supabase/server';
import { CampaignTabs } from '@/components/campaigns/campaign-tabs';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface CampaignPageProps {
  params: { id: string };
}

export default async function CampaignPage({ params }: CampaignPageProps) {
  const supabase = createClient();

  // Fetch campaign
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !campaign) {
    notFound();
  }

  // Fetch stats
  const { data: statsCounts } = await supabase
    .rpc('get_campaign_lead_counts', { p_campaign_id: params.id });

  const stats = {
    total: (statsCounts?.new || 0) + (statsCounts?.messaged || 0) +
           (statsCounts?.skipped || 0) + (statsCounts?.replied || 0),
    new: statsCounts?.new || 0,
    messaged: statsCounts?.messaged || 0,
    skipped: statsCounts?.skipped || 0,
    replied: statsCounts?.replied || 0,
    replyRate: statsCounts?.messaged > 0
      ? Math.round((statsCounts?.replied / statsCounts?.messaged) * 100)
      : 0
  };

  return (
    <div className="min-h-screen bg-[#0A0724] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Link
          href="/campaigns"
          className="inline-flex items-center text-[#F2F2F2] hover:text-white"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Campaigns
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
            <p className="text-[#F2F2F2]">
              {campaign.funnel} &bull; {campaign.status}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <CampaignTabs campaign={campaign} stats={stats} />
      </div>
    </div>
  );
}
```

### MCP Tools to Use
1. `Write` to create all four files
2. `Bash` to verify build

### Success Criteria
- [ ] Campaign page loads with tabs
- [ ] Overview tab shows stats cards
- [ ] Leads tab shows lead table
- [ ] History tab shows export logs
- [ ] Settings tab links to configurator
- [ ] Brand styling correct

---

## Task 15: Create Export History API Endpoint

### Description
Create API endpoint to fetch export logs for a campaign.

### Files to Create
- `/Sales Pipeline Dashboard/src/app/api/campaigns/[id]/exports/route.ts`

### Implementation Details

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const { data: exports, error } = await supabase
      .from('export_logs')
      .select('*')
      .eq('campaign_id', params.id)
      .order('exported_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching exports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch exports' },
        { status: 500 }
      );
    }

    return NextResponse.json({ exports: exports || [] });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### MCP Tools to Use
1. `Write` to create the route

### Success Criteria
- [ ] GET /api/campaigns/[id]/exports returns export logs
- [ ] Sorted by most recent first
- [ ] Limited to 50 records

---

## Task 16: Wire Campaign Priority Reorder API to Supabase

### Description
Update the existing campaign reorder API to use Supabase instead of mock data.

### Context
Existing route at `/Sales Pipeline Dashboard/src/app/api/campaigns/reorder/route.ts` uses mock data.

### Files to Modify
- `/Sales Pipeline Dashboard/src/app/api/campaigns/reorder/route.ts`

### Implementation Details

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface ReorderRequest {
  campaignIds: string[]; // Ordered array of campaign IDs
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body: ReorderRequest = await request.json();

    if (!body.campaignIds || !Array.isArray(body.campaignIds)) {
      return NextResponse.json(
        { error: 'campaignIds array is required' },
        { status: 400 }
      );
    }

    // Update priority for each campaign based on array order
    const updates = body.campaignIds.map((id, index) => ({
      id,
      priority: index + 1 // 1-indexed priority
    }));

    // Batch update using transaction-like approach
    for (const update of updates) {
      const { error } = await supabase
        .from('campaigns')
        .update({ priority: update.priority })
        .eq('id', update.id);

      if (error) {
        console.error(`Failed to update campaign ${update.id}:`, error);
        return NextResponse.json(
          { error: 'Failed to update priorities' },
          { status: 500 }
        );
      }
    }

    // Optionally trigger reassignment of unassigned leads
    // await supabase.rpc('reassign_unassigned_leads');

    return NextResponse.json({
      success: true,
      updated: updates.length
    });
  } catch (error) {
    console.error('Reorder error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### MCP Tools to Use
1. `Read` to get current route content
2. `Edit` or `Write` to update the route

### Success Criteria
- [ ] POST /api/campaigns/reorder updates Supabase
- [ ] Priority values set based on array order
- [ ] Returns success response

---

## Task 17: Update Dashboard to Use Real Data

### Description
Wire existing dashboard components to fetch real lead/campaign metrics from Supabase.

### Context
Existing components at:
- `/Sales Pipeline Dashboard/src/components/production/kpi-cards.tsx`
- `/Sales Pipeline Dashboard/src/components/dashboard/funnel-card.tsx`
- `/Sales Pipeline Dashboard/src/components/dashboard/campaign-table.tsx`

Currently use mock data from `/src/lib/mock/data-provider.ts`.

### Files to Modify
- `/Sales Pipeline Dashboard/src/lib/metrics/dashboard-metrics.ts` (create)
- `/Sales Pipeline Dashboard/src/app/page.tsx` (update data fetching)

### Implementation Details

**Create `/Sales Pipeline Dashboard/src/lib/metrics/dashboard-metrics.ts`:**
```typescript
import { createClient } from '@/lib/supabase/server';

export interface DashboardMetrics {
  totalLeads: number;
  newLeads: number;
  messagedLeads: number;
  repliedLeads: number;
  replyRate: number;
  campaignStats: CampaignMetric[];
  funnelStats: FunnelMetric[];
}

export interface CampaignMetric {
  id: string;
  name: string;
  funnel: string;
  status: string;
  total: number;
  new: number;
  messaged: number;
  replied: number;
  replyRate: number;
}

export interface FunnelMetric {
  funnel: string;
  totalLeads: number;
  totalMessaged: number;
  totalReplied: number;
  replyRate: number;
  campaignCount: number;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = createClient();

  // Get overall counts
  const { data: overallCounts } = await supabase
    .from('leads')
    .select('outreach_state')
    .not('campaign_id', 'is', null);

  const counts = {
    new: 0,
    messaged: 0,
    skipped: 0,
    replied: 0
  };

  overallCounts?.forEach(lead => {
    const state = lead.outreach_state as keyof typeof counts;
    if (state in counts) counts[state]++;
  });

  const totalLeads = Object.values(counts).reduce((a, b) => a + b, 0);
  const replyRate = counts.messaged > 0
    ? Math.round((counts.replied / counts.messaged) * 100)
    : 0;

  // Get per-campaign stats
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      funnel,
      status,
      leads:leads(outreach_state)
    `)
    .eq('status', 'PRODUCTION');

  const campaignStats: CampaignMetric[] = (campaigns || []).map(camp => {
    const leads = camp.leads || [];
    const campCounts = { new: 0, messaged: 0, skipped: 0, replied: 0 };
    leads.forEach((l: { outreach_state: string }) => {
      const state = l.outreach_state as keyof typeof campCounts;
      if (state in campCounts) campCounts[state]++;
    });
    const total = Object.values(campCounts).reduce((a, b) => a + b, 0);
    return {
      id: camp.id,
      name: camp.name,
      funnel: camp.funnel,
      status: camp.status,
      total,
      ...campCounts,
      replyRate: campCounts.messaged > 0
        ? Math.round((campCounts.replied / campCounts.messaged) * 100)
        : 0
    };
  });

  // Aggregate by funnel
  const funnelMap = new Map<string, FunnelMetric>();
  campaignStats.forEach(camp => {
    const existing = funnelMap.get(camp.funnel) || {
      funnel: camp.funnel,
      totalLeads: 0,
      totalMessaged: 0,
      totalReplied: 0,
      replyRate: 0,
      campaignCount: 0
    };
    existing.totalLeads += camp.total;
    existing.totalMessaged += camp.messaged;
    existing.totalReplied += camp.replied;
    existing.campaignCount++;
    funnelMap.set(camp.funnel, existing);
  });

  const funnelStats = Array.from(funnelMap.values()).map(f => ({
    ...f,
    replyRate: f.totalMessaged > 0
      ? Math.round((f.totalReplied / f.totalMessaged) * 100)
      : 0
  }));

  return {
    totalLeads,
    newLeads: counts.new,
    messagedLeads: counts.messaged,
    repliedLeads: counts.replied,
    replyRate,
    campaignStats,
    funnelStats
  };
}
```

### MCP Tools to Use
1. `Write` to create metrics file
2. `Read` then `Edit` to update page.tsx data fetching

### Success Criteria
- [ ] Dashboard shows real lead counts
- [ ] Campaign table shows real stats
- [ ] Funnel cards show aggregated data
- [ ] Reply rates calculated correctly

---

## Task 18: End-to-End Testing

### Description
Comprehensive E2E testing of the entire workflow.

### Test Scenarios

#### Test 1: Database Schema Verification
```sql
-- Run via mcp__supabase__execute_sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads'
AND column_name IN ('outreach_state', 'sales_notes', 'export_count', 'last_exported_at');

SELECT * FROM pg_type WHERE typname = 'outreach_state_enum';

SELECT COUNT(*) FROM export_logs;
```

#### Test 2: API Endpoint Tests
```bash
# Campaign leads endpoint
curl -s "http://localhost:3000/api/campaigns/[CAMPAIGN_ID]/leads?limit=5" | jq

# Bulk state update
curl -X POST "http://localhost:3000/api/leads/bulk-update-state" \
  -H "Content-Type: application/json" \
  -d '{"leadIds": ["[LEAD_ID]"], "state": "messaged"}' | jq

# Export
curl -X POST "http://localhost:3000/api/campaigns/[CAMPAIGN_ID]/leads/export" \
  -H "Content-Type: application/json" \
  -d '{"leadIds": ["[LEAD_ID]"]}' \
  --output test.csv && cat test.csv

# Notes update
curl -X PATCH "http://localhost:3000/api/leads/[LEAD_ID]/notes" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Test note from E2E"}' | jq

# InboxApp webhook
curl -X POST "http://localhost:3000/api/webhooks/inboxapp" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_id": "test",
    "events": [{
      "event_type": "reply_received",
      "timestamp": "2026-01-21T12:00:00Z",
      "conversation_id": "test123",
      "external_user": {"username": "[TWITTER_HANDLE]"},
      "message": {"text": "Test reply", "sent_at": "2026-01-21T12:00:00Z"}
    }]
  }' | jq
```

#### Test 3: UI Component Tests
```bash
# Build check
cd "/home/jeffl/projects/Integrated Sales Pipeline/Sales Pipeline Dashboard"
npm run build

# TypeScript check
npx tsc --noEmit
```

#### Test 4: Full Workflow Test
1. Navigate to campaign page
2. Verify leads table loads
3. Select leads and export CSV
4. Mark exported leads as messaged
5. Simulate InboxApp webhook
6. Verify lead state changed to replied
7. Verify stats updated

### MCP Tools to Use
1. `mcp__supabase__execute_sql` for database tests
2. `Bash` for curl tests and build checks
3. `mcp__vercel__deploy_to_vercel` for deployment
4. `mcp__vercel__get_deployment_build_logs` to verify deployment

### Success Criteria
- [ ] All database objects exist
- [ ] All API endpoints return expected data
- [ ] Build completes without errors
- [ ] Full workflow executes end-to-end
- [ ] Real-time updates work
- [ ] Export generates valid CSV
- [ ] InboxApp webhook updates lead state

---

## Execution Notes for Ralph Loop

### Order of Operations
1. Tasks 1-2: Database migrations (must complete first)
2. Task 3: TypeScript types (needed for components)
3. Tasks 4-8: API endpoints (can run in parallel)
4. Tasks 9-13: UI components (after types)
5. Tasks 14-16: Pages and wiring
6. Task 17: Dashboard updates
7. Task 18: E2E testing (final)

### MCP Tool Priority
- Use `mcp__supabase__apply_migration` for schema changes
- Use `mcp__supabase__execute_sql` for testing queries
- Use `Write`/`Edit` for code files
- Use `Bash` for build verification
- Use `mcp__vercel__deploy_to_vercel` for deployment

### Error Recovery
- If migration fails, check for existing objects
- If build fails, run `npx tsc --noEmit` for detailed errors
- If API fails, check Supabase connection and auth

### Success Events
- Migration applied: "Migration applied successfully"
- API created: Curl returns expected JSON
- Component created: TypeScript compiles without errors
- E2E complete: Full workflow executes successfully
