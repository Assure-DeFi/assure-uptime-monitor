# PRD: Implement Real-time Activity Feed with WebSockets

**Priority Score**: 12/10 (Impact: 9/10, Effort: 6/10)
**Area**: Visibility
**Type**: Full-Stack
**Complexity**: Medium (3-5 days)

## Overview

The dashboard currently shows static snapshots requiring manual refresh to see updates. Sales teams have no real-time visibility into critical events like discovery runs completing, leads being qualified, messages sent, or replies received.

This PRD implements Supabase Realtime subscriptions for live activity updates, creating an always-current dashboard that feels responsive and alive.

## Goals

- Real-time updates for key pipeline events without refresh
- Activity feed showing recent events (leads created, replies received, deals closed)
- Toast notifications for high-priority events (replies, closed deals)
- Optimistic UI updates for immediate feedback
- Graceful degradation if Realtime unavailable

## Non-Goals

- Historical activity beyond last 50 events (use audit logs)
- User-to-user chat/messaging (different feature)
- Real-time collaboration (multi-user editing)
- Video/audio notifications (toast only)

## Technical Approach

### 1. Supabase Realtime Setup

Enable Realtime on key tables:

```sql
-- Enable Realtime for activity tracking
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE discovery_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE webhook_events;
ALTER PUBLICATION supabase_realtime ADD TABLE revenue_ledger;
```

### 2. Activity Feed Data Structure

Create view for recent activity:

```sql
CREATE VIEW recent_activity AS
SELECT
  'lead_created' as event_type,
  leads.id as entity_id,
  leads.twitter_handle as summary,
  leads.created_at as occurred_at
FROM leads
WHERE leads.created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
  'reply_received' as event_type,
  leads.id as entity_id,
  leads.twitter_handle as summary,
  leads.first_replied_at as occurred_at
FROM leads
WHERE leads.first_replied_at > NOW() - INTERVAL '24 hours'
-- ... more event types
ORDER BY occurred_at DESC
LIMIT 50;
```

### 3. React Hook for Realtime

```typescript
// src/hooks/use-realtime-activity.ts
export function useRealtimeActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        handleLeadInsert
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads',
          filter: 'first_replied_at=not.null' },
        handleReplyReceived
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { events };
}
```

### 4. Activity Feed Component

Displays recent events with icons, timestamps, and context:

```typescript
<ActivityFeed>
  <ActivityItem icon={<CheckCircle />} time="2m ago">
    <strong>@cryptowhale</strong> replied to outreach
  </ActivityItem>
  <ActivityItem icon={<Users />} time="5m ago">
    Discovery run "Enterprise Q1" completed: 47 leads found
  </ActivityItem>
</ActivityFeed>
```

### Database Changes

**Migration**: `036_realtime_activity.sql`

```sql
-- Enable Realtime on tables
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE discovery_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE webhook_events;
ALTER PUBLICATION supabase_realtime ADD TABLE revenue_ledger;

-- Create activity view
CREATE OR REPLACE VIEW recent_activity AS
-- ... (full view definition)

-- Grant access
GRANT SELECT ON recent_activity TO authenticated;
```

### API Changes

None required - Realtime uses Supabase pub/sub directly.

### UI Changes

**New Components**:
- `src/components/activity/realtime-activity-feed.tsx` - Main feed component
- `src/components/activity/activity-item.tsx` - Single event row
- `src/hooks/use-realtime-activity.ts` - Realtime subscription hook
- `src/hooks/use-activity-toast.ts` - Toast notification hook

**Modified Components**:
- `src/app/(dashboard)/page.tsx` - Add activity feed to sidebar or top bar
- `src/components/layout/dashboard-header.tsx` - Activity indicator icon

## Task Breakdown

### Wave 1: Database & Schema (Parallel: 2 tasks)

| Task | Subagent | Description |
|------|----------|-------------|
| 1 | general-purpose | Create migration to enable Realtime on tables and create activity view |
| 2 | Explore | Identify all event types to track (lead states, discovery events, revenue events) |

### Wave 2: Hooks & Logic (Parallel: 2 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 3 | general-purpose | Implement useRealtimeActivity hook with Supabase subscriptions |
| 4 | general-purpose | Implement useActivityToast hook for high-priority event notifications |

### Wave 3: UI Components (Parallel: 2 tasks)

Blocked by: Wave 2

| Task | Subagent | Description |
|------|----------|-------------|
| 5 | frontend-design | Create ActivityFeed and ActivityItem components with brand styling |
| 6 | frontend-design | Add activity indicator to header with unread count badge |

### Wave 4: Integration & Testing (Sequential: 2 tasks)

Blocked by: Wave 3

| Task | Subagent | Description |
|------|----------|-------------|
| 7 | general-purpose | Integrate activity feed into dashboard, test Realtime connections |
| 8 | code-reviewer | Review for performance (subscription cleanup), brand compliance, type safety |

## Testing Strategy

**Manual Testing**:
1. Open dashboard in browser A
2. In browser B, create a lead → verify event appears in browser A
3. Mark lead as replied → verify toast notification in browser A
4. Disconnect network → verify graceful degradation (no crash)
5. Reconnect → verify subscription resumes

**Performance Testing**:
- Monitor memory usage during long session (check for subscription leaks)
- Verify channel cleanup on component unmount
- Test with 50+ rapid events (should throttle/batch)

**Type Check**: `npx tsc --noEmit`
**Build**: `npm run build`
**Migration**: `supabase migration up`

## Rollback Plan

1. Revert migration: `supabase migration down`
2. Remove activity feed component from dashboard
3. Remove Realtime subscriptions (hooks can stay, just unused)

No data loss - all events still in tables.

## Success Metrics

- Activity feed updates within 500ms of database change
- Toast notifications appear for 100% of replies
- Zero subscription memory leaks (test 4+ hour session)
- Graceful degradation if Realtime unavailable (fallback to polling)

## Acceptance Criteria

- [ ] Realtime enabled on leads, discovery_runs, webhook_events, revenue_ledger
- [ ] Activity feed shows last 50 events with live updates
- [ ] Toast notifications for replies and closed deals
- [ ] Activity indicator in header with unread count
- [ ] Subscription cleanup on unmount (no memory leaks)
- [ ] Graceful degradation if Realtime disconnected
- [ ] TypeScript compiles with no errors
- [ ] Build succeeds
- [ ] Migration applies cleanly
