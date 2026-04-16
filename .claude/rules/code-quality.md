# Code Quality Rules

These rules apply to ALL code changes across projects.

## TypeScript Standards

### Type Safety
- **Never use `any`** - use `unknown` if type is truly unknown
- **Prefer `interface`** over `type` (except for unions)
- **Document type assertions** with comments explaining why
- **Handle null/undefined** explicitly

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `ArticleCard` |
| Functions | camelCase | `fetchArticles` |
| Variables | camelCase | `articleCount` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES` |
| Types/Interfaces | PascalCase | `ContentItem` |
| Booleans | Prefixed | `isLoading`, `hasError`, `canEdit` |

### Code Style
- Maximum 2 levels of nesting
- Early returns over nested conditionals
- Immutability with spread operators
- Descriptive variable names

## Error Handling

### Required Pattern
```typescript
try {
  const result = await operation();
  return result;
} catch (error) {
  console.error('Context:', error);
  // Handle or rethrow
}
```

### API Routes
- Return proper HTTP status codes
- Include error message in response
- Log errors with context

## Component Patterns

### State Order (Mandatory)
```typescript
// 1. Error state first
if (error) return <Error message={error} />;

// 2. Loading state (when no data yet)
if (isLoading) return <Loading />;

// 3. Empty state
if (!data?.length) return <Empty />;

// 4. Success state
return <Content data={data} />;
```

### Button States
- Include `disabled` state
- Include `loading` state
- Show feedback on action

## Component Rendering Safety

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
// CORRECT pattern
{Object.entries(data).map(([key, value]) => {
  if (!value) return null;
  const Component = COMPONENT_MAP[key];
  if (!Component) return null;  // REQUIRED guard
  return <Component key={key} data={value} />;
})}
```

### Type Assertions with External Data
Never trust that external data matches TypeScript types:

```typescript
// WRONG - type assertion lies about runtime data
const Icon = ICON_MAP[key as keyof MyType];  // May be undefined!

// CORRECT - use string index with guard
const Icon = ICON_MAP[key] ?? FallbackIcon;
```

## Security Rules

1. **Authentication first** - Check session before data access
2. **Validate input** - Never trust client data
3. **Parameterize queries** - No SQL injection
4. **Escape output** - No XSS vulnerabilities
5. **No secrets in code** - Use environment variables

## Performance Guidelines

- Paginate large lists
- Use proper indexes
- Avoid N+1 queries
- Memoize expensive calculations
- Lazy load when appropriate
