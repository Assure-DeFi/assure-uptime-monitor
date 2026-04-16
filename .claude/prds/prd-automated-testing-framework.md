# PRD: Automated Testing Framework

**Priority Score**: 11/10 (Impact: 9/10, Effort: 7/10)
**Area**: Code Quality
**Type**: DevOps
**Complexity**: High (1-2 weeks)

## Overview

The Assure Sales Pipeline has zero test files across the entire codebase. No unit tests, integration tests, or E2E tests exist. Recent git history shows repeated fixes for the same types of bugs:
- Hydration errors fixed 3+ times
- Undefined component crashes fixed 4+ times
- Null access errors fixed multiple times

This indicates lack of regression testing. Production bugs that were fixed are likely to reappear when code changes. This PRD establishes a comprehensive testing framework with initial test coverage for critical paths.

## Goals

- Set up Vitest for unit/integration tests with TypeScript support
- Configure React Testing Library for component testing
- Set up Playwright for E2E tests of critical user flows
- Write 50+ unit tests for critical services (sync, discovery, ledger)
- Write component tests for top 10 most-used pages
- Add CI pipeline that fails on test failures
- Add pre-commit hook to run tests locally

## Non-Goals

- 100% code coverage (target 60% initially)
- Visual regression testing (future: Chromatic)
- Performance/load testing (separate infrastructure work)
- Mocking all external services (test against real Supabase in CI)

## Technical Approach

### 1. Configure Vitest for Unit Tests

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './dashboard/src'),
    },
  },
});
```

```typescript
// vitest.setup.ts
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
```

### 2. Write Unit Tests for Critical Services

```typescript
// src/lib/sync/__tests__/sync-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService } from '../sync-service';

describe('SyncService', () => {
  let syncService: SyncService;

  beforeEach(() => {
    syncService = new SyncService();
  });

  describe('syncFromMonday', () => {
    it('should create sync log entry', async () => {
      const result = await syncService.syncFromMonday();
      expect(result.syncLogId).toBeDefined();
      expect(result.source).toBe('monday');
    });

    it('should skip sync when Monday not configured', async () => {
      // Test with missing env vars
      const result = await syncService.syncFromMonday();
      expect(result.recordsProcessed).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should handle dry run mode', async () => {
      const result = await syncService.syncFromMonday({ dryRun: true });
      expect(result.recordsCreated).toBe(0);
      expect(result.recordsUpdated).toBe(0);
    });

    it('should assign campaigns to new leads', async () => {
      const result = await syncService.syncFromMonday();
      expect(result.recordsCreated).toBeGreaterThan(0);
      // Verify campaign assignment happened
    });
  });
});
```

### 3. Write Component Tests

```typescript
// src/components/leads/__tests__/lead-table.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadTable } from '../lead-table';

const mockLeads = [
  {
    id: '1',
    twitter_handle: '@testlead',
    campaign_id: 'camp-1',
    disqualified: false,
    message_sent: true,
    reply_received: false,
  },
];

describe('LeadTable', () => {
  it('renders leads correctly', () => {
    render(<LeadTable leads={mockLeads} />);
    expect(screen.getByText('@testlead')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<LeadTable leads={[]} isLoading={true} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when no leads', () => {
    render(<LeadTable leads={[]} isLoading={false} />);
    expect(screen.getByText(/no leads/i)).toBeInTheDocument();
  });

  it('filters leads by campaign', async () => {
    const user = userEvent.setup();
    render(<LeadTable leads={mockLeads} />);

    const filter = screen.getByRole('combobox', { name: /campaign/i });
    await user.click(filter);
    await user.click(screen.getByText('camp-1'));

    await waitFor(() => {
      expect(screen.getByText('@testlead')).toBeInTheDocument();
    });
  });

  it('sorts leads by reply rate', async () => {
    const user = userEvent.setup();
    render(<LeadTable leads={mockLeads} />);

    const sortButton = screen.getByRole('button', { name: /reply rate/i });
    await user.click(sortButton);

    // Verify sort order changed
  });
});
```

### 4. Configure Playwright for E2E Tests

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads main dashboard page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /executive weekly snapshot/i })).toBeVisible();
  });

  test('shows KPI cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/revenue/i)).toBeVisible();
    await expect(page.getByText(/reply rate/i)).toBeVisible();
  });

  test('navigates to discovery page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /discovery/i }).click();
    await expect(page).toHaveURL('/discovery');
    await expect(page.getByRole('heading', { name: /discovery engine/i })).toBeVisible();
  });

  test('filters campaign table', async ({ page }) => {
    await page.goto('/campaigns');
    await page.getByRole('combobox', { name: /funnel/i }).click();
    await page.getByText('DeFi Founders').click();

    // Verify filtered results
    const rows = await page.getByRole('row').count();
    expect(rows).toBeGreaterThan(1);
  });
});
```

### 5. Add CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, work/*]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run unit tests
        run: npm test

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            playwright-report/
            coverage/
```

### 6. Add Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run type-check
npm test --run
```

## Task Breakdown

### Wave 1: Setup Test Infrastructure (Parallel: 3 tasks)

| Task | Subagent | Description |
|------|----------|-------------|
| 1 | general-purpose | Install and configure Vitest with TypeScript support |
| 2 | general-purpose | Install and configure Playwright for E2E tests |
| 3 | general-purpose | Create vitest.setup.ts with testing utilities and mocks |

### Wave 2: Write Service Unit Tests (Parallel: 4 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 4 | general-purpose | Write sync-service.test.ts (10+ tests) |
| 5 | general-purpose | Write data-provider.test.ts (15+ tests) |
| 6 | general-purpose | Write discovery proxy-client.test.ts (10+ tests) |
| 7 | general-purpose | Write campaign-assignment.test.ts (8+ tests) |

### Wave 3: Write Component Tests (Parallel: 5 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 8 | general-purpose | Write lead-table.test.tsx (8+ tests) |
| 9 | general-purpose | Write campaign-table.test.tsx (6+ tests) |
| 10 | general-purpose | Write discovery-content.test.tsx (10+ tests) |
| 11 | general-purpose | Write revenue-chart.test.tsx (5+ tests) |
| 12 | frontend-design | Write kpi-cards.test.tsx (6+ tests) |

### Wave 4: Write E2E Tests (Parallel: 3 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 13 | general-purpose | Write dashboard.spec.ts (5+ E2E flows) |
| 14 | general-purpose | Write discovery.spec.ts (7+ E2E flows) |
| 15 | general-purpose | Write leads.spec.ts (6+ E2E flows) |

### Wave 5: CI/CD Integration (Sequential: 2 tasks)

Blocked by: Wave 2, Wave 3, Wave 4

| Task | Subagent | Description |
|------|----------|-------------|
| 16 | general-purpose | Create GitHub Actions workflow for tests |
| 17 | Bash | Install husky and add pre-commit hook |

### Wave 6: Documentation and Validation (Sequential: 1 task)

Blocked by: Wave 5

| Task | Subagent | Description |
|------|----------|-------------|
| 18 | Bash | Run full test suite, verify CI pipeline, update README |

**Summary**:
- Total Tasks: 18
- Parallel Waves: 6
- Max Parallelism: 5 tasks (Wave 3)
- Sequential steps avoided: 13

## Testing Strategy

### Test Coverage Goals
- Services: 80% coverage minimum
- Components: 60% coverage minimum
- Critical paths (auth, sync, discovery): 90% coverage

### Manual Validation
1. Run `npm test` locally - all tests pass
2. Run `npm run test:coverage` - coverage meets minimums
3. Run `npx playwright test` - E2E tests pass
4. Push to branch - CI pipeline runs and passes
5. Make breaking change - verify CI catches it

### Build Validation
- Type check: `npx tsc --noEmit`
- Build: `npm run build`
- All tests: `npm test && npx playwright test`

## Rollback Plan

1. Remove test files from `/src/**/__tests__/` and `/e2e/`
2. Remove test dependencies from package.json
3. Delete test config files (vitest.config.ts, playwright.config.ts)
4. Remove CI workflow file
5. Commit and deploy

## Success Metrics

- 50+ unit tests passing
- 20+ component tests passing
- 15+ E2E tests passing
- CI pipeline green on all PRs
- Test execution time <2 minutes for unit tests
- E2E tests complete in <5 minutes
- Pre-commit hook prevents broken commits
