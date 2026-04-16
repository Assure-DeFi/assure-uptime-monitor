interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dotClass: string; textClass: string }
> = {
  up: {
    label: "Operational",
    dotClass: "bg-status-up",
    textClass: "text-status-up",
  },
  operational: {
    label: "Operational",
    dotClass: "bg-status-up",
    textClass: "text-status-up",
  },
  down: {
    label: "Outage",
    dotClass: "bg-status-down",
    textClass: "text-status-down",
  },
  outage: {
    label: "Outage",
    dotClass: "bg-status-down",
    textClass: "text-status-down",
  },
  degraded: {
    label: "Degraded",
    dotClass: "bg-status-degraded",
    textClass: "text-status-degraded",
  },
  unknown: {
    label: "Unknown",
    dotClass: "bg-status-unknown",
    textClass: "text-status-unknown",
  },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["unknown"];

  const dotSizes = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${dotSizes[size]} ${config.dotClass} rounded-sm inline-block`}
      />
      <span className={`${textSizes[size]} ${config.textClass} font-medium`}>
        {config.label}
      </span>
    </span>
  );
}
