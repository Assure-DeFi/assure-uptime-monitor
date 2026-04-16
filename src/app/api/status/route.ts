import { NextResponse } from "next/server";
import {
  getAllMonitors,
  getLatestCheckResult,
  getUptimePercentage,
  getActiveIncidents,
} from "@/lib/db";
import { seedMonitors } from "@/lib/checker";

export const dynamic = "force-dynamic";

interface CategoryStatus {
  name: string;
  status: "operational" | "degraded" | "outage" | "unknown";
  monitors: Array<{
    name: string;
    status: string;
    uptime_90d: number;
  }>;
}

export async function GET() {
  try {
    await seedMonitors();

    const monitors = await getAllMonitors();
    const activeIncidents = await getActiveIncidents();

    const categoryMap = new Map<string, CategoryStatus>();

    for (const monitor of monitors) {
      const latestCheck = await getLatestCheckResult(monitor.id);
      const monitorStatus = latestCheck?.status ?? "unknown";

      if (!categoryMap.has(monitor.category)) {
        categoryMap.set(monitor.category, {
          name: monitor.category,
          status: "operational",
          monitors: [],
        });
      }

      const category = categoryMap.get(monitor.category)!;
      category.monitors.push({
        name: monitor.name,
        status: monitorStatus,
        uptime_90d: await getUptimePercentage(monitor.id, 2160),
      });

      if (monitorStatus === "down") {
        category.status = "outage";
      } else if (monitorStatus === "degraded" && category.status !== "outage") {
        category.status = "degraded";
      } else if (
        monitorStatus === "unknown" &&
        category.status === "operational"
      ) {
        category.status = "unknown";
      }
    }

    const categories = Array.from(categoryMap.values());

    let overallStatus: "operational" | "degraded" | "outage" = "operational";
    for (const cat of categories) {
      if (cat.status === "outage") {
        overallStatus = "outage";
        break;
      }
      if (cat.status === "degraded") {
        overallStatus = "degraded";
      }
    }

    return NextResponse.json({
      status: overallStatus,
      categories,
      active_incidents: activeIncidents,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 },
    );
  }
}
