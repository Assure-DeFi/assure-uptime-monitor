import https from "https";
import { URL } from "url";
import {
  insertCheckResult,
  getLatestCheckResult,
  isInMaintenanceWindow,
  getConsecutiveFailures,
  getRecentAlertCount,
  upsertMonitor,
  disableMonitorsNotIn,
  getEnabledMonitors,
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
  const tls = await import("tls");

  return new Promise((resolve) => {
    const parsedUrl = new URL(url);

    const socket = tls.connect(
      {
        host: parsedUrl.hostname,
        port: 443,
        servername: parsedUrl.hostname,
        rejectUnauthorized: false,
        timeout: 10000,
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        if (cert && Object.keys(cert).length > 0 && cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          const diffMs = expiryDate.getTime() - now.getTime();
          const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          socket.destroy();
          resolve({ daysRemaining, error: null });
        } else {
          socket.destroy();
          resolve({ daysRemaining: -1, error: "No certificate found" });
        }
      },
    );

    socket.on("error", (err: Error) => {
      socket.destroy();
      resolve({ daysRemaining: -1, error: err.message });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ daysRemaining: -1, error: "SSL check timed out" });
    });
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
    const errorMessage: string | null =
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
      ssl_days_remaining: daysRemaining,
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

    if (statusCode !== monitor.expected_status) {
      // 429 (rate limited) is degraded, not down — the service is up but throttling us
      if (statusCode === 429) {
        status = "degraded";
        errorMessage = `Rate limited (HTTP 429)`;
      } else {
        status = "down";
        errorMessage = `Expected status ${monitor.expected_status}, got ${statusCode}`;
      }
    }

    if (monitor.expected_keyword) {
      const bodyLower = body.toLowerCase();
      const isNegative = monitor.expected_keyword.startsWith("!");
      const keyword = isNegative
        ? monitor.expected_keyword.slice(1).toLowerCase()
        : monitor.expected_keyword.toLowerCase();
      const found = bodyLower.includes(keyword);

      if (isNegative) {
        keywordFound = found ? 0 : 1;
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
  const monitors = await getEnabledMonitors(priority);
  const results: Array<{ monitor_id: string; status: string }> = [];

  for (const monitor of monitors) {
    try {
      const result = await performCheck(monitor);

      await insertCheckResult({
        monitor_id: monitor.id,
        ...result,
      });

      results.push({ monitor_id: monitor.id, status: result.status });

      await handleAlertLogic(monitor, result);
    } catch (err) {
      console.error(`Error checking monitor ${monitor.id}:`, err);
      await insertCheckResult({
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
  if (await isInMaintenanceWindow(monitor.id)) {
    return;
  }

  const previousCheck = await getLatestCheckResult(monitor.id);
  const wasUp = !previousCheck || previousCheck.status === "up";

  if (result.status === "down" || result.status === "degraded") {
    const requiredFailures = result.status === "down" ? 3 : 2;
    const recentChecks = await getConsecutiveFailures(monitor.id, 3);
    const consecutiveFailures = recentChecks.filter(
      (c) => c.status !== "up",
    ).length;

    if (consecutiveFailures >= requiredFailures) {
      const recentAlerts = await getRecentAlertCount(
        monitor.id,
        result.status,
        30,
      );
      if (recentAlerts === 0) {
        const alertType = result.status === "down" ? "down" : "degraded";
        const message = formatAlertMessage(monitor, result, "alert");
        await sendAlerts(monitor.priority, alertType, message, monitor.id);
      }
    }
  }

  if (result.status === "up" && !wasUp && previousCheck) {
    const message = formatAlertMessage(monitor, result, "recovery");
    await sendAlerts(monitor.priority, "recovery", message, monitor.id);
  }

  if (
    monitor.check_type === "ssl" &&
    result.ssl_days_remaining !== null &&
    result.ssl_days_remaining > 0
  ) {
    const thresholds = [30, 14, 7];
    for (const threshold of thresholds) {
      if (result.ssl_days_remaining <= threshold) {
        const recentAlerts = await getRecentAlertCount(
          monitor.id,
          "ssl_expiry",
          1440,
        );
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

export async function seedMonitors(): Promise<void> {
  const configIds = new Set(MONITORS.map((m) => m.id));

  for (const m of MONITORS) {
    await upsertMonitor({
      id: m.id,
      name: m.name,
      url: m.url,
      category: m.category,
      priority: m.priority,
      check_type: m.check_type,
      expected_status: m.expected_status,
      expected_keyword: m.expected_keyword ?? null,
      timeout_ms: m.timeout_ms,
      interval_seconds: m.interval_seconds,
    });
  }

  const removed = await disableMonitorsNotIn(configIds);
  if (removed > 0) {
    console.log(`[seed] Disabled ${removed} monitors no longer in config`);
  }
}
