import { StatusBadge } from "./status-badge";
import { UptimeBar } from "./uptime-bar";

interface MonitorCardProps {
  monitor: {
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
  };
}

export function MonitorCard({ monitor }: MonitorCardProps) {
  return (
    <div className="bg-surface rounded-md border border-border p-4 hover:border-navy-lighter transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {monitor.name}
            </h3>
            <span className="text-xs px-1.5 py-0.5 rounded-sm bg-navy-lighter text-text-muted font-medium flex-shrink-0">
              {monitor.priority}
            </span>
          </div>
          <p className="text-xs text-text-muted truncate">{monitor.url}</p>
        </div>
        <div className="flex-shrink-0 ml-3">
          <StatusBadge status={monitor.current_status} size="sm" />
        </div>
      </div>

      {monitor.last_error && monitor.current_status !== "up" && (
        <div className="mb-3 px-2 py-1.5 bg-navy rounded-sm">
          <p className="text-xs text-status-down truncate">
            {monitor.last_error}
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 mb-3 text-xs text-text-muted">
        {monitor.last_response_time_ms !== null && (
          <span>
            Response:{" "}
            <span className="text-text-secondary font-medium">
              {monitor.last_response_time_ms}ms
            </span>
          </span>
        )}
        {monitor.ssl_days_remaining !== null && (
          <span>
            SSL:{" "}
            <span
              className={`font-medium ${
                monitor.ssl_days_remaining <= 7
                  ? "text-status-down"
                  : monitor.ssl_days_remaining <= 14
                    ? "text-status-degraded"
                    : "text-status-up"
              }`}
            >
              {monitor.ssl_days_remaining}d
            </span>
          </span>
        )}
        {monitor.last_checked && (
          <span className="ml-auto">
            Checked:{" "}
            <span className="text-text-secondary">
              {formatTimeAgo(monitor.last_checked)}
            </span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <UptimeBar percentage={monitor.uptime_24h} label="24h" />
        <UptimeBar percentage={monitor.uptime_7d} label="7d" />
        <UptimeBar percentage={monitor.uptime_30d} label="30d" />
        <UptimeBar percentage={monitor.uptime_90d} label="90d" />
      </div>
    </div>
  );
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
