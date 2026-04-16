# PRD: Comprehensive Error Boundaries for Dashboard

**Priority Score**: 15/10 (Impact: 9/10, Effort: 3/10)
**Area**: Frontend UX
**Type**: Frontend
**Complexity**: Small (1-2 days)

## Overview

The Assure Sales Pipeline dashboard currently has zero React error boundaries. When components crash due to hydration errors, API failures, or null access, the entire page becomes a white screen with no user feedback. This creates a terrible user experience and makes debugging difficult.

Recent commits show repeated fixes for "undefined component crashes" and "prevent null access crash" - clear evidence of component-level failures cascading to full page crashes. This PRD implements a comprehensive error boundary system to gracefully handle these failures.

## Goals

- Prevent white screen crashes from propagating beyond component boundaries
- Show user-friendly fallback UI with actionable error messages
- Log errors to console for debugging and future monitoring integration
- Provide retry mechanism to recover from transient failures
- Isolate failures to smallest possible scope

## Non-Goals

- Error monitoring/tracking service integration (future: Sentry)
- Custom error pages for different error types (one generic fallback)
- Error recovery strategies beyond simple retry
- Network request interceptors (separate HTTP client work)

## Technical Approach

### 1. Create Reusable Error Boundary Component

```typescript
// src/components/ui/error-boundary.tsx
'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-red-400 font-medium text-lg">Something went wrong</h3>
                <p className="text-red-400/70 text-sm mt-1">
                  This section encountered an error and couldn&apos;t be displayed.
                </p>
                {this.state.error && (
                  <details className="mt-3">
                    <summary className="text-red-400/60 text-xs cursor-pointer hover:text-red-400">
                      Technical details
                    </summary>
                    <pre className="text-red-400/50 text-xs mt-2 overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  size="sm"
                  className="mt-4 border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try again
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 2. Wrap Layout with Top-Level Boundary

```typescript
// src/app/layout.tsx
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

### 3. Wrap Dashboard Sections with Granular Boundaries

```typescript
// src/app/(dashboard)/page.tsx
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <ErrorBoundary>
        <Suspense fallback={<KPICardsSkeleton />}>
          <KPICardsSection />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        <Suspense fallback={<FunnelCardsSkeleton />}>
          <FunnelCardsSection />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        <Suspense fallback={<RevenueChartSkeleton />}>
          <RevenueChartSection />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
```

### 4. Add Async Error Boundary for Server Components

```typescript
// src/components/ui/async-error-boundary.tsx
'use client';

import { ErrorBoundary } from './error-boundary';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AsyncErrorBoundary({ children, fallback }: Props) {
  return (
    <ErrorBoundary
      fallback={fallback}
      onError={(error, errorInfo) => {
        // Future: Send to error tracking service
        console.error('[AsyncErrorBoundary]', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

## Task Breakdown

### Wave 1: Create Error Boundary Components (Parallel: 2 tasks)

| Task | Subagent | Description |
|------|----------|-------------|
| 1 | general-purpose | Create ErrorBoundary component with fallback UI and retry |
| 2 | general-purpose | Create AsyncErrorBoundary wrapper for server components |

### Wave 2: Integrate Error Boundaries (Parallel: 4 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 3 | general-purpose | Wrap root layout with top-level ErrorBoundary |
| 4 | general-purpose | Add boundaries to main dashboard sections |
| 5 | general-purpose | Add boundaries to discovery page sections |
| 6 | general-purpose | Add boundaries to campaigns page sections |

### Wave 3: Add Boundaries to Complex Components (Parallel: 3 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 7 | general-purpose | Wrap lead table with ErrorBoundary |
| 8 | general-purpose | Wrap revenue chart with ErrorBoundary |
| 9 | general-purpose | Wrap discovery query list with ErrorBoundary |

### Wave 4: Testing and Validation (Sequential: 1 task)

Blocked by: Wave 2, Wave 3

| Task | Subagent | Description |
|------|----------|-------------|
| 10 | Bash | Run type check, build, and manual testing |

**Summary**:
- Total Tasks: 10
- Parallel Waves: 4
- Max Parallelism: 4 tasks (Wave 2)
- Sequential steps avoided: 6

## Testing Strategy

### Manual Testing
1. Temporarily throw error in KPI section - verify rest of page renders
2. Click retry button - verify error boundary resets
3. Throw async error in server component - verify boundary catches
4. Check console for error logs with stack traces

### Build Validation
- Type check: `npx tsc --noEmit`
- Build: `npm run build`
- Verify no hydration warnings

## Rollback Plan

1. Remove ErrorBoundary wrappers from pages
2. Delete error boundary component files
3. Commit with message: "Rollback: Remove error boundaries"
4. Deploy previous version if issues persist

## Success Metrics

- Zero white screen crashes reported
- All component errors isolated to sections
- Error logs include actionable stack traces
- Retry mechanism works for 90% of transient failures
