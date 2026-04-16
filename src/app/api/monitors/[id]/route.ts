import { NextRequest, NextResponse } from "next/server";
import {
  getMonitorById,
  getCheckResultsForMonitor,
  getUptimePercentage,
  getLatestCheckResult,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const monitor = getMonitorById(id);

    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    const latestCheck = getLatestCheckResult(id);
    const history = getCheckResultsForMonitor(id, 200);

    return NextResponse.json({
      monitor: {
        ...monitor,
        current_status: latestCheck?.status ?? "unknown",
        last_checked: latestCheck?.checked_at ?? null,
        last_response_time_ms: latestCheck?.response_time_ms ?? null,
        ssl_days_remaining: latestCheck?.ssl_days_remaining ?? null,
      },
      uptime: {
        "24h": getUptimePercentage(id, 24),
        "7d": getUptimePercentage(id, 168),
        "30d": getUptimePercentage(id, 720),
        "90d": getUptimePercentage(id, 2160),
      },
      history,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching monitor:", error);
    return NextResponse.json(
      { error: "Failed to fetch monitor" },
      { status: 500 },
    );
  }
}
