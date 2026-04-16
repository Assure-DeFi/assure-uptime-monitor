# PRD: Global State Management with TanStack Query

**Priority Score**: 9/10 (Impact: 7/10, Effort: 5/10)
**Area**: Frontend UX
**Type**: Frontend
**Complexity**: Medium (3-5 days)

## Overview

Analysis found 582 instances of `useState` and `useEffect` across 96 components. Every component manually implements loading/error/empty states for data fetching. No centralized cache or request deduplication exists. Users experience:
- Blank screens during initial loads
- Redundant network requests
- Stale data when navigating back
- No loading indicators during refetches

This PRD implements TanStack Query (React Query) to centralize server state management, provide automatic caching, loading states, and request deduplication.

## Goals

- Centralize all server state management in TanStack Query
- Provide automatic loading/error states for all data fetching
- Implement smart caching with configurable stale times
- Add optimistic updates for mutations
- Reduce boilerplate by 500+ lines of manual state code
- Add global loading bar for page transitions

## Non-Goals

- Replace all useState (local UI state still uses useState)
- Implement offline-first architecture (future: persistence)
- Add Suspense boundaries (separate error boundary work)
- WebSocket/realtime integration (separate feature)

## Technical Approach

### 1. Install and Configure TanStack Query

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

```typescript
// src/app/providers.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 2. Create Query Hooks for Leads

```typescript
// src/hooks/queries/use-leads.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Lead } from '@/types/lead';

export const leadKeys = {
  all: ['leads'] as const,
  lists: () => [...leadKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...leadKeys.lists(), filters] as const,
  details: () => [...leadKeys.all, 'detail'] as const,
  detail: (id: string) => [...leadKeys.details(), id] as const,
};

export function useLeads(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: leadKeys.list(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams(filters as Record<string, string>);
      const response = await fetch(`/api/leads?${params}`);
      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      return data.leads as Lead[];
    },
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/leads/${id}`);
      if (!response.ok) throw new Error('Failed to fetch lead');
      const data = await response.json();
      return data.lead as Lead;
    },
    enabled: !!id,
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lead> }) => {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update lead');
      return response.json();
    },
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: leadKeys.detail(id) });

      // Snapshot previous value
      const previous = queryClient.getQueryData(leadKeys.detail(id));

      // Optimistically update
      queryClient.setQueryData(leadKeys.detail(id), (old: Lead | undefined) =>
        old ? { ...old, ...updates } : old
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(leadKeys.detail(variables.id), context.previous);
      }
    },
    onSettled: (data, error, { id }) => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}

export function useBulkUpdateLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<Lead> }) => {
      const response = await fetch('/api/leads/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, updates }),
      });
      if (!response.ok) throw new Error('Failed to bulk update leads');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all lead queries
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}
```

### 3. Refactor Lead Table to Use Queries

```typescript
// src/components/leads/lead-table.tsx (BEFORE)
export function LeadTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeads() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/leads');
        const data = await response.json();
        setLeads(data.leads);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLeads();
  }, []);

  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error} />;
  if (!leads.length) return <Empty />;

  return <Table data={leads} />;
}

// AFTER
export function LeadTable({ filters }: { filters?: Record<string, unknown> }) {
  const { data: leads, isLoading, error } = useLeads(filters);

  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} />;
  if (!leads?.length) return <Empty />;

  return <Table data={leads} />;
}
```

### 4. Create Discovery Campaign Queries

```typescript
// src/hooks/queries/use-discovery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DiscoveryCampaign } from '@/types/discovery';

export const discoveryKeys = {
  all: ['discovery'] as const,
  campaigns: () => [...discoveryKeys.all, 'campaigns'] as const,
  campaign: (id: string) => [...discoveryKeys.campaigns(), id] as const,
  runs: (campaignId?: string) => [...discoveryKeys.all, 'runs', campaignId] as const,
};

export function useDiscoveryCampaigns() {
  return useQuery({
    queryKey: discoveryKeys.campaigns(),
    queryFn: async () => {
      const response = await fetch('/api/discovery/campaigns');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      return data.campaigns as DiscoveryCampaign[];
    },
  });
}

export function useCreateDiscoveryCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: Omit<DiscoveryCampaign, 'id' | 'created_at'>) => {
      const response = await fetch('/api/discovery/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaign),
      });
      if (!response.ok) throw new Error('Failed to create campaign');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryKeys.campaigns() });
    },
  });
}

export function useRunDiscoveryCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/discovery/campaigns/${campaignId}/run-once`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to run campaign');
      return response.json();
    },
    onSuccess: (data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: discoveryKeys.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: discoveryKeys.runs(campaignId) });
    },
  });
}
```

### 5. Add Global Loading Bar

```typescript
// src/components/ui/loading-bar.tsx
'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function LoadingBar() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [progress, setProgress] = useState(0);

  const isLoading = isFetching > 0 || isMutating > 0;

  useEffect(() => {
    if (isLoading) {
      setProgress(30);
      const timer1 = setTimeout(() => setProgress(60), 300);
      const timer2 = setTimeout(() => setProgress(90), 600);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setProgress(100);
      const timer = setTimeout(() => setProgress(0), 200);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 bg-[#E2D243] z-50 transition-all duration-200"
      style={{
        width: `${progress}%`,
        opacity: progress === 100 ? 0 : 1,
      }}
    />
  );
}
```

## Task Breakdown

### Wave 1: Setup Infrastructure (Parallel: 2 tasks)

| Task | Subagent | Description |
|------|----------|-------------|
| 1 | general-purpose | Install TanStack Query, create query client config |
| 2 | general-purpose | Create Providers component and wrap app layout |

### Wave 2: Create Query Hooks (Parallel: 4 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 3 | general-purpose | Create use-leads.ts with queries and mutations |
| 4 | general-purpose | Create use-campaigns.ts with queries and mutations |
| 5 | general-purpose | Create use-discovery.ts with queries and mutations |
| 6 | general-purpose | Create use-ledger.ts with queries and mutations |

### Wave 3: Refactor Top Components (Parallel: 5 tasks)

Blocked by: Wave 2

| Task | Subagent | Description |
|------|----------|-------------|
| 7 | general-purpose | Refactor lead-table.tsx to use useLeads |
| 8 | general-purpose | Refactor campaign-table.tsx to use useCampaigns |
| 9 | general-purpose | Refactor discovery-content.tsx to use useDiscovery |
| 10 | general-purpose | Refactor kpi-cards.tsx to use dashboard queries |
| 11 | frontend-design | Refactor revenue-chart.tsx to use revenue queries |

### Wave 4: Add Global Features (Parallel: 2 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 12 | frontend-design | Create LoadingBar component with progress animation |
| 13 | general-purpose | Add React Query DevTools integration |

### Wave 5: Refactor Remaining Components (Parallel: 4 tasks)

Blocked by: Wave 2

| Task | Subagent | Description |
|------|----------|-------------|
| 14 | general-purpose | Refactor 10 discovery components to use queries |
| 15 | general-purpose | Refactor 8 lead components to use queries |
| 16 | general-purpose | Refactor 5 campaign components to use queries |
| 17 | general-purpose | Refactor 3 ledger components to use queries |

### Wave 6: Testing and Validation (Sequential: 1 task)

Blocked by: Wave 3, Wave 4, Wave 5

| Task | Subagent | Description |
|------|----------|-------------|
| 18 | Bash | Run type check, build, test caching and invalidation |

**Summary**:
- Total Tasks: 18
- Parallel Waves: 6
- Max Parallelism: 5 tasks (Wave 3)
- Sequential steps avoided: 14

## Testing Strategy

### Manual Validation
1. Load dashboard - verify data loads from cache on subsequent visits
2. Update lead - verify optimistic update then real update
3. Navigate away and back - verify cache serves data instantly
4. Trigger mutation - verify loading bar appears
5. Open DevTools - inspect query cache and network requests

### Performance Testing
- Measure dashboard load time before: ~3-5s
- Measure dashboard load time after: <500ms (from cache)
- Verify network request deduplication (20 duplicate requests → 0)

### Build Validation
- Type check: `npx tsc --noEmit`
- Build: `npm run build`
- No runtime errors in console

## Rollback Plan

1. Remove TanStack Query from package.json
2. Revert component changes (use git to restore)
3. Remove query hook files
4. Remove Providers wrapper from layout
5. Commit and deploy

## Success Metrics

- 96 components refactored to use queries
- 500+ lines of manual state code removed
- Dashboard loads from cache in <500ms
- Zero duplicate network requests
- Loading bar provides instant feedback
- Optimistic updates work for all mutations
- DevTools show healthy cache hits
