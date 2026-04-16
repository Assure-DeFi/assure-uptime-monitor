import https from "https";
import { URL } from "url";
import {
  getDb,
  insertCheckResult,
  getLatestCheckResult,
  isInMaintenanceWindow,
  getConsecutiveFailures,
  getRecentAlertCount,
  type MonitorRow,
} from "./db";
import { sendAlerts } from "./alerts";
import { MONITORS } from "./monitors-config";

interface CheckResult {
  status: "up" | "down" | "degraded";
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  keyword_found: number | null;
  ssl_days_remaining: number | null;
}

async function httpCheck(
  url: string,
  timeoutMs: number,
): Promise<{
  statusCode: number;
  body: string;
  responseTimeMs: number;
}> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      timeout: timeoutMs,
      headers: {
        "User-Agent": "AssureDeFi-HealthChecker/1.0",
        Accept: "text/html,application/json,*/*",
      },
      rejectUnauthorized: true,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body,
          responseTimeMs: Date.now() - start,
        });
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on("error", (err: Error) => {
      reject(err);
    });

    req.end();
  });
}

async function checkSslCertificate(url: string): Promise<{
  daysRemaining: number;
  error: string | null;
}> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      method: "HEAD",
      timeout: 10000,
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      const socket = res.socket as import("tls").TLSSocket;
      if (socket && typeof socket.getPeerCertificate === "function") {
        const cert = socket.getPeerCertificate();
        if (cert && cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          const diffMs = expiryDate.getTime() - now.getTime();
          const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          resolve({ daysRemaining, error: null });
        } else {
          resolve({ daysRemaining: -1, error: "No certificate found" });
        }
      } else {
        resolve({ daysRemaining: -1, error: "Could not access TLS socket" });
      }
      res.resume();
    });

    req.on("error", (err: Error) => {
      resolve({ daysRemaining: -1, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ daysRemaining: -1, error: "SSL check timed out" });
    });

    req.end();
  });
}

export async function performCheck(monitor: MonitorRow): Promise<CheckResult> {
  const resolvedUrl = resolveUrl(monitor.url);

  if (monitor.check_type === "ssl") {
    return performSslCheck(resolvedUrl);
  }

  if (monitor.check_type === "domain_expiry") {
    return performDomainExpiryCheck(resolvedUrl);
  }

  return performHttpCheck(monitor, resolvedUrl);
}

function resolveUrl(url: string): string {
  if (url.includes("__TOKEN__")) {
    const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
    return url.replace("__TOKEN__", token);
  }
  return url;
}

async function performDomainExpiryCheck(url: string): Promise<CheckResult> {
  try {
    const hostname = new URL(url).hostname;
    // Use RDAP (modern WHOIS replacement) to check domain expiry
    const rdapUrl = `https://rdap.verisign.com/com/v1/domain/${hostname}`;
    const response = await fetch(rdapUrl, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        status: "degraded",
        response_time_ms: null,
        status_code: response.status,
        error_message: `RDAP lookup failed: HTTP ${response.status}`,
        keyword_found: null,
        ssl_days_remaining: null,
      };
    }

    const data = (await response.json()) as {
      events?: Array<{ eventAction: string; eventDate: string }>;
    };
    const expiryEvent = data.events?.find(
      (e) => e.eventAction === "expiration",
    );

    if (!expiryEvent) {
      return {
        status: "degraded",
        response_time_ms: null,
        status_code: null,
        error_message: "No expiration date found in RDAP response",
        keyword_found: null,
        ssl_days_remaining: null,
      };
    }

    const expiryDate = new Date(expiryEvent.eventDate);
    const now = new Date();
    const daysRemaining = Math.floor(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    let status: "up" | "down" | "degraded" = "up";
    let errorMessage: string | null =
      `Domain expires in ${daysRemaining} days (${expiryDate.toISOString().split("T")[0]})`;

    if (daysRemaining <= 0) {
      status = "down";
    } else if (daysRemaining <= 30) {
      status = "degraded";
    }

    return {
      status,
      response_time_ms: null,
      status_code: null,
      error_message: errorMessage,
      keyword_found: null,
      ssl_days_remaining: daysRemaining, // reuse this field for domain days too
    };
  } catch (err) {
    return {
      status: "degraded",
      response_time_ms: null,
      status_code: null,
      error_message: `Domain expiry check failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      keyword_found: null,
      ssl_days_remaining: null,
    };
  }
}

async function performSslCheck(url: string): Promise<CheckResult> {
  try {
    const { daysRemaining, error } = await checkSslCertificate(url);
    if (error) {
      return {
        status: "down",
        response_time_ms: null,
        status_code: null,
        error_message: `SSL Error: ${error}`,
        keyword_found: null,
        ssl_days_remaining: daysRemaining,
      };
    }

    let status: "up" | "down" | "degraded" = "up";
    if (daysRemaining <= 0) {
      status = "down";
    } else if (daysRemaining <= 14) {
      status = "degraded";
    }

    return {
      status,
      response_time_ms: null,
      status_code: null,
      error_message: null,
      keyword_found: null,
      ssl_days_remaining: daysRemaining,
    };
  } catch (err) {
    return {
      status: "down",
      response_time_ms: null,
      status_code: null,
      error_message: err instanceof Error ? err.message : "Unknown SSL error",
      keyword_found: null,
      ssl_days_remaining: -1,
    };
  }
}

async function performHttpCheck(
  monitor: MonitorRow,
  url: string,
): Promise<CheckResult> {
  try {
    const { statusCode, body, responseTimeMs } = await httpCheck(
      url,
      monitor.timeout_ms,
    );

    let status: "up" | "down" | "degraded" = "up";
    let errorMessage: string | null = null;
    let keywordFound: number | null = null;

    // Check status code
    if (statusCode !== monitor.expected_status) {
      status = "down";
      errorMessage = `Expected status ${monitor.expected_status}, got ${statusCode}`;
    }

    // Check keyword if configured
    if (monitor.expected_keyword) {
      const bodyLower = body.toLowerCase();
      const isNegative = monitor.expected_keyword.startsWith("!");
      const keyword = isNegative
        ? monitor.expected_keyword.slice(1).toLowerCase()
        : monitor.expected_keyword.toLowerCase();
      const found = bodyLower.includes(keyword);

      if (isNegative) {
        keywordFound = found ? 0 : 1; // 0 = bad (keyword was found but shouldn't be)
        if (found && status === "up") {
          status = "down";
          errorMessage = `Forbidden keyword "${keyword}" found in response`;
        }
      } else {
        keywordFound = found ? 1 : 0;
        if (!found && status === "up") {
          status = "down";
          errorMessage = `Expected keyword "${monitor.expected_keyword}" not found in response`;
        }
      }
    }

    // Check for error content
    const errorPatterns = [
      "internal server error",
      "application error",
      "502 bad gateway",
      "503 service unavailable",
      "bubble error",
    ];
    const bodyLower = body.toLowerCase();
    for (const pattern of errorPatterns) {
      if (bodyLower.includes(pattern) && status === "up") {
        status = "degraded";
        errorMessage = `Error content detected: "${pattern}"`;
        break;
      }
    }

    // Check response time thresholds
    const responseTimeThreshold = monitor.check_type === "json" ? 2000 : 3000;
    if (responseTimeMs > responseTimeThreshold && status === "up") {
      status = "degraded";
      errorMessage = `Response time ${responseTimeMs}ms exceeds threshold ${responseTimeThreshold}ms`;
    }

    return {
      status,
      response_time_ms: responseTimeMs,
      status_code: statusCode,
      error_message: errorMessage,
      keyword_found: keywordFound,
      ssl_days_remaining: null,
    };
  } catch (err) {
    return {
      status: "down",
      response_time_ms: null,
      status_code: null,
      error_message: err instanceof Error ? err.message : "Unknown error",
      keyword_found: null,
      ssl_days_remaining: null,
    };
  }
}

export async function runChecksForPriority(priority?: string): Promise<{
  checked: number;
  results: Array<{ monitor_id: string; status: string }>;
}> {
  const db = getDb();
  const monitors = priority
    ? (db
        .prepare("SELECT * FROM monitors WHERE priority = ? AND is_enabled = 1")
        .all(priority) as MonitorRow[])
    : (db
        .prepare("SELECT * FROM monitors WHERE is_enabled = 1")
        .all() as MonitorRow[]);

  const results: Array<{ monitor_id: string; status: string }> = [];

  for (const monitor of monitors) {
    try {
      const result = await performCheck(monitor);

      insertCheckResult({
        monitor_id: monitor.id,
        ...result,
      });

      results.push({ monitor_id: monitor.id, status: result.status });

      // Alert logic
      await handleAlertLogic(monitor, result);
    } catch (err) {
      console.error(`Error checking monitor ${monitor.id}:`, err);
      insertCheckResult({
        monitor_id: monitor.id,
        status: "down",
        response_time_ms: null,
        status_code: null,
        error_message:
          err instanceof Error ? err.message : "Check execution failed",
        keyword_found: null,
        ssl_days_remaining: null,
      });
      results.push({ monitor_id: monitor.id, status: "down" });
    }
  }

  return { checked: results.length, results };
}

async function handleAlertLogic(
  monitor: MonitorRow,
  result: CheckResult,
): Promise<void> {
  // Skip alerts during maintenance windows
  if (isInMaintenanceWindow(monitor.id)) {
    return;
  }

  const previousCheck = getLatestCheckResult(monitor.id);
  const wasUp = !previousCheck || previousCheck.status === "up";

  // Down or degraded alert
  if (result.status === "down" || result.status === "degraded") {
    // "down" alerts immediately; "degraded" requires 2 consecutive failures
    const requiredFailures = result.status === "down" ? 1 : 2;
    const recentChecks = getConsecutiveFailures(monitor.id, 3);
    const consecutiveFailures = recentChecks.filter(
      (c) => c.status !== "up",
    ).length;

    if (consecutiveFailures >= requiredFailures) {
      // Throttle: don't re-alert within 30 minutes
      const recentAlerts = getRecentAlertCount(monitor.id, result.status, 30);
      if (recentAlerts === 0) {
        const alertType = result.status === "down" ? "down" : "degraded";
        const message = formatAlertMessage(monitor, result, "alert");
        await sendAlerts(monitor.priority, alertType, message, monitor.id);
      }
    }
  }

  // Recovery alert
  if (result.status === "up" && !wasUp && previousCheck) {
    const message = formatAlertMessage(monitor, result, "recovery");
    await sendAlerts(monitor.priority, "recovery", message, monitor.id);
  }

  // SSL expiry alerts
  if (
    monitor.check_type === "ssl" &&
    result.ssl_days_remaining !== null &&
    result.ssl_days_remaining > 0
  ) {
    const thresholds = [30, 14, 7];
    for (const threshold of thresholds) {
      if (result.ssl_days_remaining <= threshold) {
        const recentAlerts = getRecentAlertCount(
          monitor.id,
          "ssl_expiry",
          1440,
        ); // 24h throttle
        if (recentAlerts === 0) {
          const message = `SSL Certificate Warning: ${monitor.name} expires in ${result.ssl_days_remaining} days`;
          await sendAlerts(monitor.priority, "ssl_expiry", message, monitor.id);
        }
        break;
      }
    }
  }
}

function formatAlertMessage(
  monitor: MonitorRow,
  result: CheckResult,
  type: "alert" | "recovery",
): string {
  if (type === "recovery") {
    return `RECOVERED: ${monitor.name} (${monitor.url}) is back up. Response time: ${result.response_time_ms ?? "N/A"}ms`;
  }

  const parts = [
    `ALERT [${monitor.priority}]: ${monitor.name} is ${result.status.toUpperCase()}`,
    `URL: ${monitor.url}`,
  ];

  if (result.error_message) {
    parts.push(`Error: ${result.error_message}`);
  }
  if (result.status_code !== null) {
    parts.push(`Status Code: ${result.status_code}`);
  }
  if (result.response_time_ms !== null) {
    parts.push(`Response Time: ${result.response_time_ms}ms`);
  }

  return parts.join("\n");
}

export function seedMonitors(): void {
  const db = getDb();
  const existingCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM monitors").get() as {
      cnt: number;
    }
  ).cnt;

  if (existingCount > 0) return;

  const insert = db.prepare(
    `INSERT OR IGNORE INTO monitors (id, name, url, category, priority, check_type, expected_status, expected_keyword, timeout_ms, interval_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertMany = db.transaction((monitors: typeof MONITORS) => {
    for (const m of monitors) {
      insert.run(
        m.id,
        m.name,
        m.url,
        m.category,
        m.priority,
        m.check_type,
        m.expected_status,
        m.expected_keyword ?? null,
        m.timeout_ms,
        m.interval_seconds,
      );
    }
  });

  insertMany(MONITORS);
  console.log(`Seeded ${MONITORS.length} monitors`);
}
