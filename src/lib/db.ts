import path from "path";

// ---------------------------------------------------------------------------
// Database abstraction — Postgres in production, SQLite in local dev
//
// If DATABASE_URL is set, the pg Pool is used (async).
// If not, better-sqlite3 is used via a thin async wrapper so all exported
// functions share the same async signature regardless of backend.
// ---------------------------------------------------------------------------

// --- Shared interfaces ------------------------------------------------------

export interface MonitorRow {
  id: string;
  name: string;
  url: string;
  category: string;
  priority: string;
  check_type: string;
  expected_status: number;
  expected_keyword: string | null;
  timeout_ms: number;
  interval_seconds: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface CheckResultRow {
  id: number;
  monitor_id: string;
  status: string;
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  keyword_found: number | null;
  ssl_days_remaining: number | null;
  checked_at: string;
}

export interface IncidentRow {
  id: number;
  monitor_id: string | null;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  started_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Internal DbClient interface
// ---------------------------------------------------------------------------

interface DbClient {
  /** Returns 0-N rows. */
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Returns first row or undefined. */
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  /** Fire-and-forget mutation — no return value. */
  execute(sql: string, params?: unknown[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Postgres backend
// ---------------------------------------------------------------------------

function buildPgClient(databaseUrl: string): DbClient {
  // Dynamic require keeps better-sqlite3 out of the require path on Railway
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");

  const pool = new Pool({ connectionString: databaseUrl });

  /**
   * Translate SQLite positional `?` placeholders to Postgres `$1, $2, …`
   * and adjust dialect-specific SQL fragments.
   */
  function translate(sql: string): string {
    let i = 0;
    let out = sql.replace(/\?/g, () => `$${++i}`);

    // datetime('now') → NOW()::TEXT
    out = out.replace(/datetime\('now'\)/gi, "NOW()::TEXT");

    // datetime('now', '-X minutes/hours/days') → (NOW() - INTERVAL 'X unit')::TEXT
    out = out.replace(
      /datetime\('now',\s*'(-?\d+)\s+(minutes?|hours?|days?)'\)/gi,
      (_m, num, unit) =>
        `(NOW() - INTERVAL '${Math.abs(parseInt(num))} ${unit}')::TEXT`,
    );

    // updated_at = datetime('now') (from updateIncident sets array)
    out = out.replace(
      /updated_at\s*=\s*datetime\('now'\)/gi,
      "updated_at = NOW()::TEXT",
    );

    return out;
  }

  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const { rows } = await pool.query(translate(sql), params);
      return rows as T[];
    },
    async queryOne<T>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T | undefined> {
      const { rows } = await pool.query(translate(sql), params);
      return rows[0] as T | undefined;
    },
    async execute(sql: string, params: unknown[] = []): Promise<void> {
      await pool.query(translate(sql), params);
    },
  };
}

// Postgres schema uses SERIAL and NOW() instead of SQLite equivalents
const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
    check_type TEXT NOT NULL DEFAULT 'http' CHECK (check_type IN ('http', 'keyword', 'ssl', 'json', 'domain_expiry')),
    expected_status INTEGER DEFAULT 200,
    expected_keyword TEXT,
    timeout_ms INTEGER DEFAULT 5000,
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
    updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
  );

  CREATE TABLE IF NOT EXISTS check_results (
    id SERIAL PRIMARY KEY,
    monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    keyword_found INTEGER,
    ssl_days_remaining INTEGER,
    checked_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
  );

  CREATE INDEX IF NOT EXISTS idx_check_results_monitor_id ON check_results(monitor_id);
  CREATE INDEX IF NOT EXISTS idx_check_results_checked_at ON check_results(checked_at);
  CREATE INDEX IF NOT EXISTS idx_check_results_monitor_checked ON check_results(monitor_id, checked_at DESC);

  CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    monitor_id TEXT REFERENCES monitors(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
    severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('critical', 'major', 'minor')),
    started_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
    updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
  );

  CREATE TABLE IF NOT EXISTS incident_updates (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
  );

  CREATE TABLE IF NOT EXISTS maintenance_windows (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    monitor_ids TEXT,
    created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
  );

  CREATE TABLE IF NOT EXISTS alert_log (
    id SERIAL PRIMARY KEY,
    monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('down', 'degraded', 'recovery', 'ssl_expiry', 'keyword_missing')),
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'email')),
    message TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
  );
`;

// ---------------------------------------------------------------------------
// SQLite backend — wraps synchronous better-sqlite3 in async shim
// ---------------------------------------------------------------------------

function buildSqliteClient(): DbClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite3 =
    require("better-sqlite3") as typeof import("better-sqlite3");
  const DB_PATH = path.join(process.cwd(), "data", "health-checker.db");
  const sqlite = new BetterSqlite3(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
      check_type TEXT NOT NULL DEFAULT 'http' CHECK (check_type IN ('http', 'keyword', 'ssl', 'json', 'domain_expiry')),
      expected_status INTEGER DEFAULT 200,
      expected_keyword TEXT,
      timeout_ms INTEGER DEFAULT 5000,
      interval_seconds INTEGER NOT NULL DEFAULT 60,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS check_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
      response_time_ms INTEGER,
      status_code INTEGER,
      error_message TEXT,
      keyword_found INTEGER,
      ssl_days_remaining INTEGER,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_check_results_monitor_id ON check_results(monitor_id);
    CREATE INDEX IF NOT EXISTS idx_check_results_checked_at ON check_results(checked_at);
    CREATE INDEX IF NOT EXISTS idx_check_results_monitor_checked ON check_results(monitor_id, checked_at DESC);

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id TEXT REFERENCES monitors(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
      severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('critical', 'major', 'minor')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS incident_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      monitor_ids TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      alert_type TEXT NOT NULL CHECK (alert_type IN ('down', 'degraded', 'recovery', 'ssl_expiry', 'keyword_missing')),
      channel TEXT NOT NULL CHECK (channel IN ('telegram', 'email')),
      message TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async queryOne<T>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T | undefined> {
      return sqlite.prepare(sql).get(...params) as T | undefined;
    },
    async execute(sql: string, params: unknown[] = []): Promise<void> {
      sqlite.prepare(sql).run(...params);
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton client initialisation
// ---------------------------------------------------------------------------

let _client: DbClient | null = null;
let _pgInitialised = false;

async function getClient(): Promise<DbClient> {
  if (_client) return _client;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const pgClient = buildPgClient(databaseUrl);
    if (!_pgInitialised) {
      await pgClient.execute(PG_SCHEMA);
      _pgInitialised = true;
    }
    _client = pgClient;
  } else {
    // SQLite schema init runs inside buildSqliteClient()
    _client = buildSqliteClient();
  }

  return _client;
}

// ---------------------------------------------------------------------------
// Public API — all functions are async
// ---------------------------------------------------------------------------

export async function getAllMonitors(): Promise<MonitorRow[]> {
  const db = await getClient();
  return db.query<MonitorRow>("SELECT * FROM monitors ORDER BY priority, name");
}

export async function getMonitorById(
  id: string,
): Promise<MonitorRow | undefined> {
  const db = await getClient();
  return db.queryOne<MonitorRow>("SELECT * FROM monitors WHERE id = ?", [id]);
}

export async function getLatestCheckResult(
  monitorId: string,
): Promise<CheckResultRow | undefined> {
  const db = await getClient();
  return db.queryOne<CheckResultRow>(
    "SELECT * FROM check_results WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1",
    [monitorId],
  );
}

export async function getCheckResultsForMonitor(
  monitorId: string,
  limit: number = 100,
): Promise<CheckResultRow[]> {
  const db = await getClient();
  return db.query<CheckResultRow>(
    "SELECT * FROM check_results WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?",
    [monitorId, limit],
  );
}

export async function insertCheckResult(result: {
  monitor_id: string;
  status: string;
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  keyword_found: number | null;
  ssl_days_remaining: number | null;
}): Promise<void> {
  const db = await getClient();
  await db.execute(
    `INSERT INTO check_results
       (monitor_id, status, response_time_ms, status_code, error_message, keyword_found, ssl_days_remaining)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      result.monitor_id,
      result.status,
      result.response_time_ms,
      result.status_code,
      result.error_message,
      result.keyword_found,
      result.ssl_days_remaining,
    ],
  );
}

export async function getUptimePercentage(
  monitorId: string,
  hours: number,
): Promise<number> {
  const db = await getClient();
  const row = await db.queryOne<{
    total: number | string;
    up_count: number | string;
  }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
     FROM check_results
     WHERE monitor_id = ? AND checked_at >= datetime('now', '-${hours} hours')`,
    [monitorId],
  );

  const total = Number(row?.total ?? 0);
  const upCount = Number(row?.up_count ?? 0);
  if (total === 0) return 100;
  return Math.round((upCount / total) * 10000) / 100;
}

export async function getActiveIncidents(): Promise<IncidentRow[]> {
  const db = await getClient();
  return db.query<IncidentRow>(
    "SELECT * FROM incidents WHERE status != 'resolved' ORDER BY started_at DESC",
  );
}

export async function getAllIncidents(
  limit: number = 50,
): Promise<IncidentRow[]> {
  const db = await getClient();
  return db.query<IncidentRow>(
    "SELECT * FROM incidents ORDER BY started_at DESC LIMIT ?",
    [limit],
  );
}

export async function getIncidentById(
  id: number,
): Promise<IncidentRow | undefined> {
  const db = await getClient();
  return db.queryOne<IncidentRow>("SELECT * FROM incidents WHERE id = ?", [id]);
}

export async function createIncident(incident: {
  monitor_id?: string;
  title: string;
  description?: string;
  severity?: string;
}): Promise<IncidentRow> {
  const db = await getClient();

  if (process.env.DATABASE_URL) {
    // Postgres supports RETURNING
    const row = await db.queryOne<IncidentRow>(
      `INSERT INTO incidents (monitor_id, title, description, severity)
       VALUES (?, ?, ?, ?) RETURNING *`,
      [
        incident.monitor_id ?? null,
        incident.title,
        incident.description ?? null,
        incident.severity ?? "minor",
      ],
    );
    if (!row) throw new Error("Failed to create incident");
    return row;
  }

  // SQLite: INSERT then fetch
  await db.execute(
    `INSERT INTO incidents (monitor_id, title, description, severity)
     VALUES (?, ?, ?, ?)`,
    [
      incident.monitor_id ?? null,
      incident.title,
      incident.description ?? null,
      incident.severity ?? "minor",
    ],
  );
  const row = await db.queryOne<IncidentRow>(
    "SELECT * FROM incidents ORDER BY id DESC LIMIT 1",
  );
  if (!row) throw new Error("Failed to create incident");
  return row;
}

export async function updateIncident(
  id: number,
  updates: { status?: string; resolved_at?: string; description?: string },
): Promise<IncidentRow | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.status) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.resolved_at) {
    sets.push("resolved_at = ?");
    values.push(updates.resolved_at);
  }
  if (updates.description) {
    sets.push("description = ?");
    values.push(updates.description);
  }
  sets.push("updated_at = datetime('now')");
  values.push(id);

  if (sets.length === 1) return getIncidentById(id);

  const db = await getClient();

  if (process.env.DATABASE_URL) {
    return db.queryOne<IncidentRow>(
      `UPDATE incidents SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
      values,
    );
  }

  await db.execute(
    `UPDATE incidents SET ${sets.join(", ")} WHERE id = ?`,
    values,
  );
  return getIncidentById(id);
}

export async function isInMaintenanceWindow(
  monitorId: string,
): Promise<boolean> {
  const db = await getClient();
  const now = new Date().toISOString();
  const row = await db.queryOne<{ cnt: number | string }>(
    `SELECT COUNT(*) as cnt FROM maintenance_windows
     WHERE starts_at <= ? AND ends_at >= ?
     AND (monitor_ids IS NULL OR monitor_ids LIKE ?)`,
    [now, now, `%${monitorId}%`],
  );
  return Number(row?.cnt ?? 0) > 0;
}

export async function cleanOldCheckResults(
  daysToKeep: number = 90,
): Promise<void> {
  const db = await getClient();
  const cutoff = new Date(
    Date.now() - daysToKeep * 24 * 60 * 60 * 1000,
  ).toISOString();
  await db.execute("DELETE FROM check_results WHERE checked_at < ?", [cutoff]);
}

export async function getConsecutiveFailures(
  monitorId: string,
  count: number,
): Promise<CheckResultRow[]> {
  const db = await getClient();
  return db.query<CheckResultRow>(
    `SELECT * FROM check_results WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?`,
    [monitorId, count],
  );
}

export async function getRecentAlertCount(
  monitorId: string,
  alertType: string,
  withinMinutes: number,
): Promise<number> {
  const db = await getClient();
  const row = await db.queryOne<{ cnt: number | string }>(
    `SELECT COUNT(*) as cnt FROM alert_log
     WHERE monitor_id = ? AND alert_type = ? AND sent_at >= datetime('now', '-${withinMinutes} minutes')`,
    [monitorId, alertType],
  );
  return Number(row?.cnt ?? 0);
}

export async function logAlert(
  monitorId: string,
  alertType: string,
  channel: string,
  message: string,
): Promise<void> {
  const db = await getClient();
  await db.execute(
    `INSERT INTO alert_log (monitor_id, alert_type, channel, message) VALUES (?, ?, ?, ?)`,
    [monitorId, alertType, channel, message],
  );
}

// ---------------------------------------------------------------------------
// Helpers used by checker.ts seedMonitors
// ---------------------------------------------------------------------------

export async function getMonitorCount(): Promise<number> {
  const db = await getClient();
  const row = await db.queryOne<{ cnt: number | string }>(
    "SELECT COUNT(*) as cnt FROM monitors",
  );
  return Number(row?.cnt ?? 0);
}

export async function insertMonitor(m: {
  id: string;
  name: string;
  url: string;
  category: string;
  priority: string;
  check_type: string;
  expected_status: number;
  expected_keyword: string | null;
  timeout_ms: number;
  interval_seconds: number;
}): Promise<void> {
  const db = await getClient();
  if (process.env.DATABASE_URL) {
    await db.execute(
      `INSERT INTO monitors
         (id, name, url, category, priority, check_type, expected_status, expected_keyword, timeout_ms, interval_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [
        m.id,
        m.name,
        m.url,
        m.category,
        m.priority,
        m.check_type,
        m.expected_status,
        m.expected_keyword,
        m.timeout_ms,
        m.interval_seconds,
      ],
    );
  } else {
    await db.execute(
      `INSERT OR IGNORE INTO monitors
         (id, name, url, category, priority, check_type, expected_status, expected_keyword, timeout_ms, interval_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        m.name,
        m.url,
        m.category,
        m.priority,
        m.check_type,
        m.expected_status,
        m.expected_keyword,
        m.timeout_ms,
        m.interval_seconds,
      ],
    );
  }
}

export async function getEnabledMonitors(
  priority?: string,
): Promise<MonitorRow[]> {
  const db = await getClient();
  if (priority) {
    return db.query<MonitorRow>(
      "SELECT * FROM monitors WHERE priority = ? AND is_enabled = 1",
      [priority],
    );
  }
  return db.query<MonitorRow>("SELECT * FROM monitors WHERE is_enabled = 1");
}
