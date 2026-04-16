# PRD: Add Comprehensive Error Boundaries to Dashboard

**Priority Score**: 13/10 (Impact: 8/10, Effort: 3/10)
**Area**: Dashboard UX
**Type**: Frontend
**Complexity**: Low (1-2 days)

## Overview

The dashboard currently has no error boundary protection. When any component throws an error (invalid API data, null reference, parsing failure), the entire page crashes to a white screen. Users lose all context and must refresh the browser.

This PRD implements React error boundaries at strategic levels to provide graceful degradation, preserve user context, and enable retry mechanisms.

## Goals

- Prevent white screen crashes from component errors
- Provide user-friendly error fallback UI with actionable options
- Log errors for debugging without disrupting user workflow
- Enable granular isolation (page-level, section-level, component-level)
- Maintain brand compliance in error states

## Non-Goals

- Backend error handling (covered by API routes)
- Network error handling (covered by fetch wrappers)
- Build-time TypeScript errors (different category)
- Error monitoring service integration (future work, separate PRD)

## Technical Approach

### 1. Create Base Error Boundary Component

Create reusable `ErrorBoundary` component following React 18 patterns:

```typescript
// src/components/ui/error-boundary.tsx
interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'page' | 'section' | 'widget';
}
```

### 2. Create Error Fallback Components

Three levels of fallback UI:

- **PageErrorFallback**: Full-page error with navigation home
- **SectionErrorFallback**: Section card with retry button
- **WidgetErrorFallback**: Small inline error with reload icon

All follow brand guidelines (navy background, gold accents, Inter font).

### 3. Integration Points

Wrap components at strategic levels:

- **Page-level**: Dashboard layout wraps all routes
- **Section-level**: KPI cards, charts, tables (each independently wrapped)
- **Widget-level**: Individual cards, modals (where beneficial)

### Database Changes

None required.

### API Changes

None required.

### UI Changes

**New Components**:
- `src/components/ui/error-boundary.tsx`
- `src/components/ui/error-fallback.tsx` (three variants)

**Modified Components**:
- `src/app/(dashboard)/layout.tsx` - Add page-level boundary
- `src/app/(dashboard)/page.tsx` - Add section-level boundaries
- All Suspense-wrapped async components

## Task Breakdown

### Wave 1: Foundation (Parallel: 3 tasks)

| Task | Subagent | Description |
|------|----------|-------------|
| 1 | general-purpose | Create ErrorBoundary component with state management and lifecycle methods |
| 2 | frontend-design | Create three ErrorFallback UI components (page, section, widget) following brand guidelines |
| 3 | Explore | Audit all async components and Suspense boundaries to identify wrap points |

### Wave 2: Integration (Parallel: 2 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 4 | general-purpose | Wrap dashboard layout and main page with error boundaries |
| 5 | general-purpose | Wrap all section-level components (KPIs, charts, tables) |

### Wave 3: Testing & Documentation (Sequential: 2 tasks)

Blocked by: Wave 2

| Task | Subagent | Description |
|------|----------|-------------|
| 6 | general-purpose | Test error boundaries by forcing errors, verify fallback UI, test retry mechanisms |
| 7 | code-reviewer | Review all changes for type safety, brand compliance, and error handling patterns |

## Testing Strategy

**Manual Testing**:
1. Force error in KPI section: verify section fallback shows, rest of page works
2. Force error in async component: verify Suspense fallback → error fallback flow
3. Click retry: verify component remounts and re-fetches
4. Force error in layout: verify page-level fallback with home navigation

**Type Check**: `npx tsc --noEmit`
**Build**: `npm run build`
**Visual QA**: Verify brand colors, spacing, typography

## Rollback Plan

Error boundaries are additive and non-breaking. To rollback:
1. Remove ErrorBoundary imports from modified files
2. Restore original layout.tsx and page.tsx from git
3. No database or API changes to revert

## Success Metrics

- Zero white screen crashes in production (down from current unknown rate)
- Error fallback UI visible in < 100ms after component error
- User can retry or navigate away without browser refresh
- All errors logged to console with component stack trace

## Acceptance Criteria

- [ ] ErrorBoundary component handles errors and renders fallback
- [ ] Three fallback variants (page, section, widget) follow brand guidelines
- [ ] Page-level boundary wraps dashboard layout
- [ ] Section-level boundaries on KPIs, charts, tables
- [ ] Retry button successfully remounts component
- [ ] TypeScript compiles with no errors
- [ ] Build succeeds
- [ ] Manual testing passes all scenarios
