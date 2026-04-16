interface OverallStatusProps {
  status: "operational" | "degraded" | "outage" | "unknown";
  monitorCount: number;
  upCount: number;
}

const STATUS_DISPLAY: Record<
  string,
  { label: string; bgClass: string; textClass: string }
> = {
  operational: {
    label: "All Systems Operational",
    bgClass: "bg-status-up/10 border-status-up/30",
    textClass: "text-status-up",
  },
  degraded: {
    label: "Partial System Degradation",
    bgClass: "bg-status-degraded/10 border-status-degraded/30",
    textClass: "text-status-degraded",
  },
  outage: {
    label: "System Outage Detected",
    bgClass: "bg-status-down/10 border-status-down/30",
    textClass: "text-status-down",
  },
  unknown: {
    label: "Status Unknown",
    bgClass: "bg-status-unknown/10 border-status-unknown/30",
    textClass: "text-status-unknown",
  },
};

export function OverallStatus({
  status,
  monitorCount,
  upCount,
}: OverallStatusProps) {
  const display = STATUS_DISPLAY[status] ?? STATUS_DISPLAY["unknown"];

  return (
    <div className={`rounded-md border ${display.bgClass} p-6 mb-8`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${display.textClass}`}>
            {display.label}
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {upCount} of {monitorCount} monitors operational
          </p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${display.textClass}`}>
            {monitorCount > 0 ? Math.round((upCount / monitorCount) * 100) : 0}%
          </div>
          <p className="text-xs text-text-muted">Overall Health</p>
        </div>
      </div>
    </div>
  );
}
