# Hydration Safety Rules

These rules prevent React hydration errors (Error #418 and #425) across all Next.js projects.

## Why Hydration Errors Happen

Server-rendered HTML must EXACTLY match client-rendered HTML during React hydration.
These patterns cause mismatches because server and client produce different values:

| Pattern | Why It Fails |
|---------|--------------|
| `date.toLocaleTimeString()` | Server/client may have different timezones or locales |
| `date.toLocaleDateString()` | Same as above |
| `date.toLocaleString()` | Same as above |
| `new Date()` in render | Different timestamps between server and client render |
| `formatDistanceToNow(date)` | Time elapsed between server and client render |
| `Math.random()` | Different values on each render |
| `value.toLocaleString()` | Locale differences between server and client |
| `window`/`document` access | Undefined on server |

## Solution Patterns

### For Next.js Dashboard Projects

Use hydration-safe hooks from `@/hooks/use-client-date`:

```typescript
import {
  useFormattedTime,
  useFormattedDate,
  useFormattedDateTime,
  useTimeAgo,
  useFormattedNumber,
  useFormattedCurrency,
} from '@/hooks/use-client-date';

function MyComponent({ timestamp, count }: Props) {
  const time = useFormattedTime(timestamp);
  const date = useFormattedDate(timestamp);
  const formatted = useFormattedNumber(count);

  return <div>{date} - {time} ({formatted} items)</div>;
}
```

### For Client-Only Content

Wrap with a `ClientOnly` component:

```typescript
import { ClientOnly } from '@/components/ui/client-only';
import { Skeleton } from '@/components/ui/skeleton';

function MyComponent() {
  return (
    <ClientOnly fallback={<Skeleton className="h-4 w-20" />}>
      <DynamicContent />
    </ClientOnly>
  );
}
```

### For General React/Next.js

Create a similar pattern:

```typescript
'use client';
import { useEffect, useState } from 'react';

function useClientValue<T>(getValue: () => T, serverValue: T): T {
  const [value, setValue] = useState<T>(serverValue);
  useEffect(() => {
    setValue(getValue());
  }, [getValue]);
  return value;
}
```

## Banned Patterns in Components

| Pattern | Use Instead |
|---------|-------------|
| `new Date().toLocaleString()` | `useFormattedDateTime()` |
| `date.toLocaleDateString()` | `useFormattedDate()` |
| `date.toLocaleTimeString()` | `useFormattedTime()` |
| `new Date()` without args | `useCurrentYear()` or `ClientOnly` |
| `value.toLocaleString()` | `useFormattedNumber()` |
| Direct `window`/`document` | `useEffect` or `ClientOnly` |

## Testing for Hydration Errors

1. **Build check**: `npm run build` - Next.js warns about mismatches
2. **Browser DevTools**: React logs hydration errors in console
3. **Timezone test**: Change system timezone and reload
4. **Disable JS**: Page should render correctly without JS

## Where Hooks Live

| Project Type | Hook Location |
|--------------|---------------|
| dashboard | `@/hooks/use-client-date` |
| Other Next.js | Create similar hooks in `hooks/` |
| Shared packages | `@org/ui-hooks` if available |

## Creating Hydration-Safe Hooks

If your project doesn't have these hooks, create them:

```typescript
// hooks/use-client-date.ts
'use client';
import { useEffect, useState } from 'react';

export function useFormattedDate(timestamp: string | null): string {
  const [formatted, setFormatted] = useState('');

  useEffect(() => {
    if (!timestamp) return;
    setFormatted(new Date(timestamp).toLocaleDateString());
  }, [timestamp]);

  return formatted;
}
```

## Related Rules

- See `react-component-safety.md` for render crash prevention
- See project-specific rules in `dashboard/.claude/rules/hydration.md` for detailed patterns
