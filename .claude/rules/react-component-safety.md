# React Component Safety Rules

These rules prevent React Error #130 (undefined component) and related render crashes.

## The Problem

React crashes with Error #130 when you try to render `undefined` or `null` as a component:

```
Element type is invalid: expected a string (for built-in components)
or a class/function (for composite components) but got: undefined
```

This commonly happens when:
1. Looking up a component from an object/map with a key that doesn't exist
2. Conditionally rendering a component that might be undefined
3. Iterating over data with keys that don't have matching components

## Required Patterns

### Dynamic Component Lookup

When rendering components from an object/map lookup, ALWAYS check existence:

```typescript
// WRONG - crashes if Icon is undefined
const Icon = ICON_MAP[key];
return <Icon className="..." />;

// CORRECT - guard before render
const Icon = ICON_MAP[key];
if (!Icon) return null;
return <Icon className="..." />;

// CORRECT - fallback pattern
const Icon = ICON_MAP[key] ?? DefaultIcon;
return <Icon className="..." />;
```

### Object Iteration for Rendering

When mapping over object entries to render components:

```typescript
// WRONG - assumes all keys have components
{Object.entries(data).map(([key, value]) => {
  const Component = COMPONENT_MAP[key];
  return <Component data={value} />;  // Crashes if key not in map
})}

// CORRECT - guard unknown keys
{Object.entries(data).map(([key, value]) => {
  if (!value) return null;
  const Component = COMPONENT_MAP[key];
  if (!Component) return null;  // Skip gracefully
  return <Component key={key} data={value} />;
})}

// CORRECT - fallback pattern
{Object.entries(data).map(([key, value]) => {
  if (!value) return null;
  const Component = COMPONENT_MAP[key] ?? FallbackComponent;
  return <Component key={key} data={value} />;
})}
```

### Type-Safe Component Maps

Use `Record<string, ...>` instead of `Record<keyof Type, ...>` when data comes from external sources:

```typescript
// WRONG - assumes data matches TypeScript type exactly
const ICON_MAP: Record<keyof Benefits, IconType> = { ... };
const Icon = ICON_MAP[key as keyof Benefits];  // Lie! key may not be in Benefits

// CORRECT - allow any string key, handle missing
const ICON_MAP: Record<string, IconType> = { ... };
const Icon = ICON_MAP[key] ?? DefaultIcon;
```

### Conditional Component Rendering

When a component might not exist:

```typescript
// WRONG - crashes if Component is undefined
const Component = props.component;
return <Component />;

// CORRECT - check first
const Component = props.component;
if (!Component) return <Fallback />;
return <Component />;
```

## Common Crash Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `<Map[key] />` | Key not in map | Add guard or fallback |
| `key as keyof Type` | Type assertion lie | Use string index with guard |
| `Object.entries().map()` | Unknown keys in data | Check component exists |
| Dynamic imports | Module not loaded | Use Suspense + error boundary |

## When This Applies

- Rendering icons based on a category/type field
- Showing status badges from a status map
- Dynamic form fields based on field type
- Plugin/extension systems
- Any data-driven component selection

## Prevention Checklist

Before rendering a component from a variable:

- [ ] Is the component definitely defined?
- [ ] Does the lookup key always exist in the map?
- [ ] Could external data contain unknown keys?
- [ ] Is there a sensible fallback?

## Related Rules

- See `runtime-data-validation.md` for validating external data
- See `code-quality.md` for general component patterns
