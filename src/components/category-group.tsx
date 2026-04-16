import { StatusBadge } from "./status-badge";
import { MonitorCard } from "./monitor-card";

interface Monitor {
  id: string;
  name: string;
  url: string;
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

interface CategoryGroupProps {
  category: string;
  monitors: Monitor[];
}

export function CategoryGroup({ category, monitors }: CategoryGroupProps) {
  const categoryStatus = getCategoryStatus(monitors);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary">{category}</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {monitors.length} monitor{monitors.length !== 1 ? "s" : ""}
          </span>
          <StatusBadge status={categoryStatus} size="sm" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {monitors.map((monitor) => (
          <MonitorCard key={monitor.id} monitor={monitor} />
        ))}
      </div>
    </div>
  );
}

function getCategoryStatus(monitors: Monitor[]): string {
  if (monitors.some((m) => m.current_status === "down")) return "down";
  if (monitors.some((m) => m.current_status === "degraded")) return "degraded";
  if (monitors.every((m) => m.current_status === "up")) return "up";
  return "unknown";
}
