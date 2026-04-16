---
name: nextjs-patterns
description: Next.js App Router patterns, API routes, server components, and project conventions for article-intake. Use when creating pages, API endpoints, components, or working with Next.js. Keywords: api, route, page, component, server, client, nextjs, app router, fetch, handler.
---

# Next.js Patterns for Article-Intake

## Project Structure

```
src/
├── app/                    # App Router pages and API routes
│   ├── api/               # API routes
│   │   └── {resource}/
│   │       └── route.ts   # HTTP handlers
│   ├── dashboard/         # Dashboard pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   └── {feature}/        # Feature-specific components
├── lib/                   # Utilities and business logic
│   ├── db/               # Database queries
│   ├── auth.ts           # Auth configuration
│   └── utils.ts          # Helper functions
└── types/                 # TypeScript types
```

## API Route Patterns

### Basic Route Structure

```typescript
// src/app/api/{resource}/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/{resource}
 * Description of what this endpoint does
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const param = searchParams.get('param');

    // 3. Business logic
    const result = await someQuery();

    // 4. Return response
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/{resource}:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/{resource}
 * Description
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.field) {
      return NextResponse.json(
        { error: 'Field is required' },
        { status: 400 }
      );
    }

    const result = await createResource(body);
    return NextResponse.json({ item: result }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/{resource}:', error);
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  }
}
```

### Dynamic Route with ID

```typescript
// src/app/api/{resource}/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  // ... use id
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  const body = await request.json();
  // ... update by id
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  // ... delete by id
}
```

### Action Routes (Nested)

```typescript
// src/app/api/{resource}/[id]/{action}/route.ts
// e.g., /api/content/[id]/publish/route.ts

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Perform action on resource
}
```

## Response Patterns

### Success Responses

```typescript
// Single item
return NextResponse.json({ item: result });

// List with pagination
return NextResponse.json({
  items: results,
  total: count,
  offset,
  limit
});

// Created
return NextResponse.json({ item: result }, { status: 201 });

// No content
return new NextResponse(null, { status: 204 });
```

### Error Responses

```typescript
// 400 Bad Request - validation error
return NextResponse.json(
  { error: 'Field is required' },
  { status: 400 }
);

// 401 Unauthorized
return NextResponse.json(
  { error: 'Unauthorized' },
  { status: 401 }
);

// 404 Not Found
return NextResponse.json(
  { error: 'Resource not found' },
  { status: 404 }
);

// 500 Internal Server Error
return NextResponse.json(
  { error: 'Failed to process request' },
  { status: 500 }
);
```

## Component Patterns

### Server Component (Default)

```tsx
// No 'use client' directive
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function Page() {
  const session = await getServerSession(authOptions);
  const data = await fetchData();

  return <div>{/* render data */}</div>;
}
```

### Client Component

```tsx
'use client';

import { useState, useEffect } from 'react';

export function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Client-side fetching
  }, []);

  return <div>{/* interactive UI */}</div>;
}
```

### Loading State Pattern

```tsx
'use client';

import { Loader2 } from 'lucide-react';

export function DataComponent() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState(null);

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (isLoading) {
    return <Loader2 className="h-6 w-6 animate-spin" />;
  }

  if (!data) {
    return <div>No data found</div>;
  }

  return <div>{/* render data */}</div>;
}
```

## Authentication Pattern

```typescript
// lib/auth.ts exports authOptions
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// In API routes
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Access user info
const userEmail = session.user?.email;
```

## Data Fetching Patterns

### Server-Side (in Server Components)

```typescript
// Direct database query (preferred for server components)
import { db } from '@/lib/db';

const data = await db.query.table.findMany();
```

### Client-Side

```typescript
// Using fetch
const response = await fetch('/api/resource');
const data = await response.json();

// With error handling
try {
  const response = await fetch('/api/resource');
  if (!response.ok) {
    throw new Error('Failed to fetch');
  }
  const data = await response.json();
} catch (error) {
  console.error('Fetch error:', error);
}
```

## Import Aliases

```typescript
// Use @ alias for src directory
import { Button } from '@/components/ui/button';
import { authOptions } from '@/lib/auth';
import type { ContentItem } from '@/lib/db/types';
```

## Type Definitions

```typescript
// src/types/index.ts or src/lib/db/types.ts

export type ContentItemStatus =
  | 'SUGGESTED'
  | 'APPROVED'
  | 'DRAFTING'
  | 'DRAFT_READY'
  | 'APPROVED_TO_PUBLISH'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface ContentItem {
  id: string;
  title: string;
  status: ContentItemStatus;
  created_at: string;
  updated_at: string;
}
```

## Quick Reference

### Creating a New API Route

1. Create file: `src/app/api/{resource}/route.ts`
2. Import NextRequest, NextResponse, auth
3. Add authentication check
4. Implement handlers (GET, POST, etc.)
5. Add proper error handling
6. Log errors with context

### Creating a New Page

1. Create file: `src/app/{path}/page.tsx`
2. Server component by default
3. Add 'use client' only if needed
4. Use loading.tsx for suspense

### Creating a New Component

1. Create file: `src/components/{feature}/{Component}.tsx`
2. Use TypeScript interfaces for props
3. Follow brand guidelines for styling
4. Handle loading/error/empty states
