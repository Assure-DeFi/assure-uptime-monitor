# PRD: Re-enable Authentication and Authorization System

**Priority Score**: 12/10 (Impact: 10/10, Effort: 8/10)
**Area**: Auth & Security
**Type**: Full-Stack
**Complexity**: High (1-2 weeks)

## Overview

Authentication is completely disabled across the entire application. Middleware, auth context, admin checks, and API session validation all have "TODO: Re-enable auth" comments. This is a critical production security vulnerability - anyone with the URL can access admin features, view revenue data, and modify campaigns.

This PRD re-enables Supabase OAuth authentication, restores middleware protection, implements role-based access control, and adds session validation to all protected API routes.

## Goals

- Re-enable Supabase OAuth authentication (Google, GitHub providers)
- Restore middleware to protect all dashboard routes
- Implement role-based access control (Admin, Discovery, Ledger roles)
- Add session validation to protected API routes
- Enable audit trails with authenticated user attribution
- Preserve development experience with local auth bypass option

## Non-Goals

- Multi-factor authentication (future enhancement)
- Custom email/password auth (OAuth only for now)
- SSO/SAML integration (enterprise feature)
- Session replay/monitoring (separate observability work)

## Technical Approach

### 1. Supabase Auth Configuration

Configure OAuth providers in Supabase dashboard:
- Enable Google OAuth
- Enable GitHub OAuth
- Set redirect URLs (production + preview environments)
- Configure email templates

### 2. Middleware Restoration

Re-enable middleware from ORIGINAL code:

```typescript
// src/middleware.ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export async function middleware(request: NextRequest) {
  // Check for dev bypass flag
  if (process.env.AUTH_BYPASS === 'true') {
    return NextResponse.next();
  }

  // Check public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Validate session
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect('/login?redirect=' + pathname);
  }

  return NextResponse.next();
}
```

### 3. Auth Context Restoration

Re-enable AuthContext from ORIGINAL_AUTH_CONTEXT.md:

```typescript
// src/contexts/auth-context.tsx
export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppUserRole[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoles(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserRoles(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, roles }}>{children}</AuthContext.Provider>;
}
```

### 4. Role-Based Access Control

Implement role checks using existing user_roles table:

```typescript
// src/lib/auth/rbac.ts
export function requireRole(role: AppUserRole) {
  const { roles } = useAuth();
  if (!roles.includes(role)) {
    throw new Error(`Requires ${role} role`);
  }
}

export function hasRole(role: AppUserRole): boolean {
  const { roles } = useAuth();
  return roles.includes(role);
}
```

### 5. API Route Protection

Add session validation to all protected API routes:

```typescript
// src/lib/auth/api-guard.ts
export async function requireAuth(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return user;
}

// Usage in API routes
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user; // Error response

  // ... proceed with authenticated logic
}
```

### Database Changes

**Migration**: `037_auth_re_enable.sql`

```sql
-- No schema changes needed, tables already exist:
-- - user_roles (links users to roles)
-- - Roles: admin, discovery_user, ledger_user, ledger_admin

-- Add RLS policies for user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles"
  ON user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- Ensure audit tables capture user_id
ALTER TABLE lead_audit_log
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE ledger_audit_log
  ALTER COLUMN user_id SET DEFAULT auth.uid();
```

### API Changes

**Protected Routes** (add session validation):
- All `/api/campaigns/*`
- All `/api/leads/*`
- All `/api/discovery/*`
- All `/api/ledger/*`
- All `/api/admin/*`

**Public Routes** (no auth required):
- `/api/webhooks/*` (verified by signature)
- `/api/auth/*`

### UI Changes

**New Components**:
- `src/app/(auth)/login/page.tsx` - OAuth login page
- `src/components/auth/login-form.tsx` - OAuth provider buttons
- `src/components/auth/role-badge.tsx` - Show user's roles

**Modified Components**:
- `src/contexts/auth-context.tsx` - Re-enable full auth logic
- `src/middleware.ts` - Re-enable route protection
- `src/lib/auth/admin-check.ts` - Re-enable admin checks
- `src/components/layout/dashboard-header.tsx` - Add user menu with logout
- All API routes - Add session validation

## Task Breakdown

### Wave 1: Configuration & Schema (Parallel: 3 tasks)

| Task | Subagent | Description |
|------|----------|-------------|
| 1 | Explore | Document all current auth TODOs and files needing changes |
| 2 | general-purpose | Configure OAuth providers in Supabase (Google, GitHub) |
| 3 | general-purpose | Create migration for RLS policies and audit defaults |

### Wave 2: Core Auth Restoration (Parallel: 2 tasks)

Blocked by: Wave 1

| Task | Subagent | Description |
|------|----------|-------------|
| 4 | general-purpose | Re-enable middleware from ORIGINAL code with dev bypass flag |
| 5 | general-purpose | Re-enable AuthContext from ORIGINAL_AUTH_CONTEXT.md |

### Wave 3: RBAC Implementation (Parallel: 2 tasks)

Blocked by: Wave 2

| Task | Subagent | Description |
|------|----------|-------------|
| 6 | general-purpose | Implement role-checking utilities (requireRole, hasRole) |
| 7 | general-purpose | Create API guard helper (requireAuth) for route protection |

### Wave 4: API Route Protection (Parallel: 4 tasks)

Blocked by: Wave 3

| Task | Subagent | Description |
|------|----------|-------------|
| 8 | general-purpose | Add requireAuth to all /api/campaigns/* routes |
| 9 | general-purpose | Add requireAuth to all /api/leads/* routes |
| 10 | general-purpose | Add requireAuth to all /api/discovery/* routes |
| 11 | general-purpose | Add requireAuth to all /api/ledger/* and /api/admin/* routes |

### Wave 5: UI Updates (Parallel: 2 tasks)

Blocked by: Wave 4

| Task | Subagent | Description |
|------|----------|-------------|
| 12 | frontend-design | Create login page with OAuth provider buttons (brand compliant) |
| 13 | frontend-design | Add user menu to header with role badges and logout |

### Wave 6: Testing & Documentation (Sequential: 3 tasks)

Blocked by: Wave 5

| Task | Subagent | Description |
|------|----------|-------------|
| 14 | general-purpose | Test OAuth flow end-to-end (Google + GitHub) |
| 15 | general-purpose | Test role-based access (admin vs non-admin) |
| 16 | code-reviewer | Review all auth code for security issues, audit trail compliance |

## Testing Strategy

**Manual Testing**:
1. **Unauthenticated access**: Visit dashboard → redirects to /login
2. **OAuth login**: Click Google → redirects to Google → redirects back logged in
3. **Role access**: Non-admin user → cannot access /admin routes (403)
4. **Admin access**: Admin user → can access all routes
5. **API protection**: Call protected API without session → 401 response
6. **Logout**: Click logout → session cleared, redirected to login
7. **Audit trails**: Create campaign → audit log has correct user_id

**Security Testing**:
- Try accessing /admin without admin role → blocked
- Try calling protected API with expired token → rejected
- Try accessing protected route without session → redirected
- Verify RLS policies prevent unauthorized data access

**Type Check**: `npx tsc --noEmit`
**Build**: `npm run build`
**Migration**: `supabase migration up`

## Rollback Plan

If issues arise:
1. Set `AUTH_BYPASS=true` in environment variables (emergency bypass)
2. Revert middleware.ts to empty matcher
3. Revert AuthContext to mock version
4. Remove requireAuth from API routes

No data loss - auth tables and RLS can stay in place.

## Success Metrics

- 100% of protected routes require authentication
- OAuth login success rate > 95%
- Zero unauthorized access to admin/ledger features
- All audit logs have valid user_id attribution
- Session token refresh works seamlessly

## Acceptance Criteria

- [ ] Middleware enforces authentication on all protected routes (/*, except public)
- [ ] OAuth login works for Google and GitHub providers
- [ ] AuthContext provides user and roles to all components
- [ ] Role-based access restricts admin, discovery, ledger features
- [ ] All protected API routes validate session tokens
- [ ] Login page follows brand guidelines (navy, gold, Inter font)
- [ ] User menu shows current user email and roles
- [ ] Logout clears session and redirects to login
- [ ] Audit logs capture authenticated user for all actions
- [ ] Dev bypass flag (AUTH_BYPASS=true) works for local development
- [ ] TypeScript compiles with no errors
- [ ] Build succeeds
- [ ] Migration applies cleanly
- [ ] All manual tests pass
- [ ] Security testing shows no bypasses
