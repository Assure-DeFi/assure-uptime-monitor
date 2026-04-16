# Outreach System Dev Memory

Persistent memory for the Outreach System Dev agent. Append learnings here.

---

## Constraint: Outbound event dedup requires timestamp-window matching
**Discovered**: 2026-03-27
**Type**: constraint
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: dm-queue-worker seeds dm_conversation_events with X API dm_event_id. Thread-syncer later syncs the same message from InboxApp using InboxApp's own message ID. Upsert on dm_event_id cannot dedup because they are different IDs for the same logical message.
**Pattern**: Before upserting an outbound event in thread-syncer, check for an existing row with the same outreach_message_id + direction='outbound' + event_timestamp within a 60-second window + different dm_event_id. If found, UPDATE the existing row's dm_event_id to InboxApp's ID instead of inserting. This makes future syncs idempotent via the normal dm_event_id upsert path.
**Why**: Without this guard, every outbound message appears twice in the conversation history — once from the seed insert and once from InboxApp sync.

## Pattern: Use upsert with ignoreDuplicates for non-primary event inserts
**Discovered**: 2026-03-27
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: pain-funnel-service.ts used raw .insert() for dm_conversation_events when recording follow-up DMs. If the same dm_event_id was already present (from thread-syncer), the insert would fail or create a duplicate.
**Pattern**: Always use `.upsert({...}, { onConflict: 'dm_event_id', ignoreDuplicates: true })` instead of `.insert()` for dm_conversation_events writes outside the primary seed path.
**Why**: Multiple code paths can write the same event. ignoreDuplicates makes all paths idempotent without error.
