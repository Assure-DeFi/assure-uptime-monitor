import { OverallStatus } from "@/components/overall-status";
import { CategoryGroup } from "@/components/category-group";
import { IncidentList } from "@/components/incident-list";
import { StatusPageClient } from "@/components/status-page-client";
import {
  getAllMonitors,
  getLatestCheckResult,
  getUptimePercentage,
  getActiveIncidents,
  getAllIncidents,
} from "@/lib/db";
import { seedMonitors } from "@/lib/checker";

export const dynamic = "force-dynamic";

interface MonitorWithStatus {
  id: string;
  name: string;
  url: string;
  category: string;
  priority: string;
  check_type: string;
  current_status: string;
  last_checked: string | null;
  last_response_time_ms: number | null;
  last_error: string | null;
  ssl_days_remaining: number | null;
  uptime_24h: number;
  uptime_7d: number;
  uptime_30d: number;
  uptime_90d: number;
}

async function getMonitorsWithStatus(): Promise<MonitorWithStatus[]> {
  await seedMonitors();
  const monitors = await getAllMonitors();

  return Promise.all(
    monitors.map(async (monitor) => {
      const latestCheck = await getLatestCheckResult(monitor.id);
      return {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        category: monitor.category,
        priority: monitor.priority,
        check_type: monitor.check_type,
        current_status: latestCheck?.status ?? "unknown",
        last_checked: latestCheck?.checked_at ?? null,
        last_response_time_ms: latestCheck?.response_time_ms ?? null,
        last_error: latestCheck?.error_message ?? null,
        ssl_days_remaining: latestCheck?.ssl_days_remaining ?? null,
        uptime_24h: await getUptimePercentage(monitor.id, 24),
        uptime_7d: await getUptimePercentage(monitor.id, 168),
        uptime_30d: await getUptimePercentage(monitor.id, 720),
        uptime_90d: await getUptimePercentage(monitor.id, 2160),
      };
    }),
  );
}

export default async function StatusPage() {
  const monitors = await getMonitorsWithStatus();
  const activeIncidents = await getActiveIncidents();
  const recentIncidents = await getAllIncidents(10);

  // Group monitors by category
  const categories = new Map<string, MonitorWithStatus[]>();
  const categoryOrder = [
    "Main Site",
    "Next.js Pages",
    "Webflow Pages",
    "Subdomains",
    "API Endpoints",
    "External Services",
    "SSL & Domain",
  ];

  for (const monitor of monitors) {
    const existing = categories.get(monitor.category) ?? [];
    existing.push(monitor);
    categories.set(monitor.category, existing);
  }

  // Compute overall status
  const upCount = monitors.filter((m) => m.current_status === "up").length;
  const hasDown = monitors.some((m) => m.current_status === "down");
  const hasDegraded = monitors.some((m) => m.current_status === "degraded");
  const hasChecked = monitors.some((m) => m.last_checked !== null);

  let overallStatus: "operational" | "degraded" | "outage" | "unknown" =
    "operational";
  if (hasDown) overallStatus = "outage";
  else if (hasDegraded) overallStatus = "degraded";
  else if (!hasChecked) overallStatus = "unknown";

  return (
    <main className="min-h-screen bg-navy">
      {/* Header */}
      <header className="border-b border-border bg-surface-raised">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gold rounded-sm flex items-center justify-center">
                <span className="text-navy font-bold text-sm">A</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">
                  Assure DeFi
                </h1>
                <p className="text-xs text-text-muted">System Status</p>
              </div>
            </div>
            <StatusPageClient />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Status Banner */}
        <OverallStatus
          status={overallStatus}
          monitorCount={monitors.length}
          upCount={upCount}
        />

        {/* Active Incidents */}
        {activeIncidents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Active Incidents
            </h2>
            <IncidentList incidents={activeIncidents} />
          </div>
        )}

        {/* Monitor Categories */}
        {categoryOrder.map((categoryName) => {
          const categoryMonitors = categories.get(categoryName);
          if (!categoryMonitors || categoryMonitors.length === 0) return null;
          return (
            <CategoryGroup
              key={categoryName}
              category={categoryName}
              monitors={categoryMonitors}
            />
          );
        })}

        {/* Recent Incidents */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-text-primary mb-4 pb-2 border-b border-border">
            Recent Incidents
          </h2>
          <IncidentList incidents={recentIncidents} />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-surface-raised mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Assure DeFi Health Monitor</span>
            <span>Monitoring {monitors.length} endpoints</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
