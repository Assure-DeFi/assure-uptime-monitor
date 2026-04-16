# platform-engineer Memory

Persistent memory for the platform-engineer agent. Append learnings here.

---

## Pattern: Dual-backend DB abstraction (Postgres + SQLite)
**Domain**: general
**Discovered**: 2026-04-14
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Valid-Until**: ongoing
**Context**: health-checker app needed Postgres for Railway production with SQLite local dev fallback
**Pattern**: Build an internal `DbClient` interface with `query<T>`, `queryOne<T>`, `execute` methods. Implement two backends behind it — one using `pg` Pool, one wrapping `better-sqlite3` synchronously. Pick backend in a singleton `getClient()` based on `DATABASE_URL` presence. All public exported functions become async and call `getClient()`.
**Why**: This pattern avoids ORMs, keeps raw SQL, and ensures callers never need to know which backend is active. Both backends can be kept as dependencies; dynamic require keeps each out of the other's load path.

## Pattern: SQLite → Postgres SQL translation
**Domain**: general
**Discovered**: 2026-04-14
**Type**: pattern
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: translating SQLite DDL/DML to Postgres in the dual-backend setup
**Pattern**:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `datetime('now')` → `NOW()::TEXT` (cast to TEXT to match the TEXT column type)
- `datetime('now', '-X minutes')` → `(NOW() - INTERVAL 'X minutes')::TEXT`
- `?` placeholders → `$1, $2, …` (count replacements in order)
- `INSERT OR IGNORE INTO` → `INSERT INTO … ON CONFLICT (id) DO NOTHING`
- SQLite `RETURNING *` works; Postgres also supports it — but SQLite requires a separate SELECT for non-RETURNING paths
- `COUNT(*)` returns TEXT/bigint in Postgres — always wrap with `Number()` before arithmetic
**Why**: These are the exact points where SQLite and Postgres diverge in this schema. Missing the `::TEXT` cast on `NOW()` in a TEXT column causes type mismatches.

## Constraint: pg COUNT() returns string in Node.js driver
**Domain**: general
**Discovered**: 2026-04-14
**Type**: constraint
**Supersedes**: none
**Invocations-Since**: 0
**References**: 0
**Context**: pg driver returns bigint columns (like COUNT(*)) as strings, not numbers
**Pattern**: Always `Number(row?.cnt ?? 0)` or `Number(row?.total ?? 0)` when reading aggregate columns. Same for `SUM()`. Never assume numeric type from pg query results.
**Why**: The pg driver maps PostgreSQL bigint to JS string to avoid precision loss. Arithmetic on strings silently concatenates instead of adding.
