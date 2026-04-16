interface Incident {
  id: number;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  started_at: string;
  resolved_at: string | null;
}

interface IncidentListProps {
  incidents: Incident[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-l-status-down text-status-down",
  major: "border-l-status-degraded text-status-degraded",
  minor: "border-l-text-muted text-text-muted",
};

const STATUS_LABELS: Record<string, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

export function IncidentList({ incidents }: IncidentListProps) {
  if (incidents.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-text-muted text-sm">
          No incidents reported. All systems operational.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((incident) => {
        const severityStyle =
          SEVERITY_STYLES[incident.severity] ?? SEVERITY_STYLES["minor"];
        const statusLabel = STATUS_LABELS[incident.status] ?? incident.status;

        return (
          <div
            key={incident.id}
            className={`bg-surface border border-border border-l-4 ${severityStyle} rounded-md p-4`}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-primary">
                {incident.title}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-sm bg-navy-lighter text-text-muted font-medium flex-shrink-0 ml-2">
                {statusLabel}
              </span>
            </div>
            {incident.description && (
              <p className="text-xs text-text-muted mb-2">
                {incident.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span>Started: {formatDate(incident.started_at)}</span>
              {incident.resolved_at && (
                <span>Resolved: {formatDate(incident.resolved_at)}</span>
              )}
              <span className="capitalize">{incident.severity}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
