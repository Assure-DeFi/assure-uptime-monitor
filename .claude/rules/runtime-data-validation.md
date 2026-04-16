# Runtime Data Validation Rules

TypeScript types are compile-time only. Database data, API responses, and external inputs
may not match your types at runtime. These rules prevent runtime crashes.

## The Problem

```typescript
// TypeScript says this is BacklogBenefits
const benefits: BacklogBenefits = item.benefits_json;

// But at runtime, it might have keys TypeScript doesn't know about
// This causes crashes when you access properties that don't exist
const Icon = ICON_MAP[key as keyof BacklogBenefits]; // Undefined if key not in type!
```

## Required Patterns

### 1. Guard Dynamic Property Access

```typescript
// WRONG - assumes key exists in map
const Icon = ICON_MAP[key as keyof MyType];
return <Icon />;  // Crashes if key not in map

// CORRECT - guard with fallback
const Icon = ICON_MAP[key] ?? DefaultIcon;
return <Icon />;
```

### 2. Validate External Data at Boundaries

```typescript
// API route receiving data
const data = await request.json();

// WRONG - trust the data matches type
const item = data as BacklogItem;

// CORRECT - validate shape
const parsed = BacklogItemSchema.safeParse(data);
if (!parsed.success) {
  return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
}
const item = parsed.data;
```

### 3. Use Zod for Runtime Validation

```typescript
import { z } from 'zod';

// Define schema that matches your interface
const BacklogBenefitsSchema = z.object({
  sales: z.string().nullable().optional(),
  operations: z.string().nullable().optional(),
  revenue: z.string().nullable().optional(),
  reliability: z.string().nullable().optional(),
  performance: z.string().nullable().optional(),
  ux: z.string().nullable().optional(),
}).passthrough();  // Allow extra keys without crashing

// Derive type from schema (ensures sync)
type BacklogBenefits = z.infer<typeof BacklogBenefitsSchema>;
```

### 4. Safe Object Iteration

```typescript
// WRONG - assumes all keys have handlers
Object.entries(data).map(([key, value]) => {
  const handler = HANDLERS[key];
  return handler(value);  // Crashes if key unknown
});

// CORRECT - skip unknown keys
Object.entries(data).map(([key, value]) => {
  const handler = HANDLERS[key];
  if (!handler) return null;  // Skip gracefully
  return handler(value);
});
```

### 5. Type-Narrowing Guards

```typescript
// Create type guard for known keys
function isKnownBenefitKey(key: string): key is keyof BacklogBenefits {
  return ['sales', 'operations', 'revenue', 'reliability', 'performance', 'ux'].includes(key);
}

// Use in iteration
Object.entries(benefits).map(([key, value]) => {
  if (!isKnownBenefitKey(key)) {
    console.warn(`Unknown benefit key: ${key}`);
    return null;
  }
  const Icon = ICON_MAP[key]; // Now TypeScript knows key is valid
  return <Icon />;
});
```

## Where to Apply

Apply these patterns when handling:

- Database query results
- API response parsing
- Webhook payloads
- Form submissions
- URL parameters
- localStorage/sessionStorage reads
- JSON.parse results
- External API responses

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| `data as Type` | Lies to TypeScript | Use Zod validation |
| `key as keyof Type` | Assumes key is valid | Guard with fallback |
| `Object.entries()` without guards | Unknown keys crash | Check handler exists |
| `JSON.parse(str) as Type` | No validation | Wrap in Zod parse |
| Trusting `req.body` | Could be anything | Validate schema |

## Validation Library Choices

| Library | Use Case |
|---------|----------|
| Zod | General-purpose, good TypeScript inference |
| Yup | Form validation, good error messages |
| io-ts | Functional programming style |
| Superstruct | Lightweight alternative |

This project prefers **Zod** for consistency.

## Testing Runtime Validation

```typescript
// Test that unknown keys don't crash
it('handles unknown benefit keys gracefully', () => {
  const data = {
    benefits_json: {
      sales: 'Helps sales',
      unknown_key: 'Should not crash',
    },
  };

  // Should not throw
  expect(() => renderComponent(data)).not.toThrow();
});
```

## Related Rules

- See `react-component-safety.md` for component render safety
- See `code-quality.md` for general patterns
