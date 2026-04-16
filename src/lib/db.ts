import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "health-checker.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
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
}

// --- Monitor queries ---

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

export function getAllMonitors(): MonitorRow[] {
  return getDb()
    .prepare("SELECT * FROM monitors ORDER BY priority, name")
    .all() as MonitorRow[];
}

export function getMonitorById(id: string): MonitorRow | undefined {
  return getDb().prepare("SELECT * FROM monitors WHERE id = ?").get(id) as
    | MonitorRow
    | undefined;
}

export function getLatestCheckResult(
  monitorId: string,
): CheckResultRow | undefined {
  return getDb()
    .prepare(
      "SELECT * FROM check_results WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1",
    )
    .get(monitorId) as CheckResultRow | undefined;
}

export function getCheckResultsForMonitor(
  monitorId: string,
  limit: number = 100,
): CheckResultRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM check_results WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?",
    )
    .all(monitorId, limit) as CheckResultRow[];
}

export function insertCheckResult(result: {
  monitor_id: string;
  status: string;
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  keyword_found: number | null;
  ssl_days_remaining: number | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO check_results (monitor_id, status, response_time_ms, status_code, error_message, keyword_found, ssl_days_remaining)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      result.monitor_id,
      result.status,
      result.response_time_ms,
      result.status_code,
      result.error_message,
      result.keyword_found,
      result.ssl_days_remaining,
    );
}

export function getUptimePercentage(monitorId: string, hours: number): number {
  const row = getDb()
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
      FROM check_results
      WHERE monitor_id = ? AND checked_at >= datetime('now', ?)`,
    )
    .get(monitorId, `-${hours} hours`) as { total: number; up_count: number };

  if (row.total === 0) return 100;
  return Math.round((row.up_count / row.total) * 10000) / 100;
}

export function getActiveIncidents(): IncidentRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM incidents WHERE status != 'resolved' ORDER BY started_at DESC",
    )
    .all() as IncidentRow[];
}

export function getAllIncidents(limit: number = 50): IncidentRow[] {
  return getDb()
    .prepare("SELECT * FROM incidents ORDER BY started_at DESC LIMIT ?")
    .all(limit) as IncidentRow[];
}

export function getIncidentById(id: number): IncidentRow | undefined {
  return getDb().prepare("SELECT * FROM incidents WHERE id = ?").get(id) as
    | IncidentRow
    | undefined;
}

export function createIncident(incident: {
  monitor_id?: string;
  title: string;
  description?: string;
  severity?: string;
}): IncidentRow {
  const result = getDb()
    .prepare(
      `INSERT INTO incidents (monitor_id, title, description, severity) VALUES (?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      incident.monitor_id ?? null,
      incident.title,
      incident.description ?? null,
      incident.severity ?? "minor",
    ) as IncidentRow;
  return result;
}

export function updateIncident(
  id: number,
  updates: { status?: string; resolved_at?: string; description?: string },
): IncidentRow | undefined {
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

  return getDb()
    .prepare(`UPDATE incidents SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
    .get(...values) as IncidentRow | undefined;
}

export function isInMaintenanceWindow(monitorId: string): boolean {
  const now = new Date().toISOString();
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as cnt FROM maintenance_windows
       WHERE starts_at <= ? AND ends_at >= ?
       AND (monitor_ids IS NULL OR monitor_ids LIKE ?)`,
    )
    .get(now, now, `%${monitorId}%`) as { cnt: number };
  return row.cnt > 0;
}

export function cleanOldCheckResults(daysToKeep: number = 90): void {
  const cutoff = new Date(
    Date.now() - daysToKeep * 24 * 60 * 60 * 1000,
  ).toISOString();
  getDb().prepare("DELETE FROM check_results WHERE checked_at < ?").run(cutoff);
}

export function getConsecutiveFailures(
  monitorId: string,
  count: number,
): CheckResultRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM check_results WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?`,
    )
    .all(monitorId, count) as CheckResultRow[];
}

export function getRecentAlertCount(
  monitorId: string,
  alertType: string,
  withinMinutes: number,
): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as cnt FROM alert_log
       WHERE monitor_id = ? AND alert_type = ? AND sent_at >= datetime('now', ?)`,
    )
    .get(monitorId, alertType, `-${withinMinutes} minutes`) as { cnt: number };
  return row.cnt;
}

export function logAlert(
  monitorId: string,
  alertType: string,
  channel: string,
  message: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO alert_log (monitor_id, alert_type, channel, message) VALUES (?, ?, ?, ?)`,
    )
    .run(monitorId, alertType, channel, message);
}
