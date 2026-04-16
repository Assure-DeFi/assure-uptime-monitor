import { NextResponse } from "next/server";
import {
  getAllMonitors,
  getLatestCheckResult,
  getUptimePercentage,
} from "@/lib/db";
import { seedMonitors } from "@/lib/checker";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    seedMonitors();

    const monitors = getAllMonitors();
    const monitorsWithStatus = monitors.map((monitor) => {
      const latestCheck = getLatestCheckResult(monitor.id);
      return {
        ...monitor,
        current_status: latestCheck?.status ?? "unknown",
        last_checked: latestCheck?.checked_at ?? null,
        last_response_time_ms: latestCheck?.response_time_ms ?? null,
        last_status_code: latestCheck?.status_code ?? null,
        last_error: latestCheck?.error_message ?? null,
        ssl_days_remaining: latestCheck?.ssl_days_remaining ?? null,
        uptime_24h: getUptimePercentage(monitor.id, 24),
        uptime_7d: getUptimePercentage(monitor.id, 168),
        uptime_30d: getUptimePercentage(monitor.id, 720),
        uptime_90d: getUptimePercentage(monitor.id, 2160),
      };
    });

    return NextResponse.json({
      monitors: monitorsWithStatus,
      total: monitorsWithStatus.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching monitors:", error);
    return NextResponse.json(
      { error: "Failed to fetch monitors" },
      { status: 500 },
    );
  }
}
