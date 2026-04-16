interface UptimeBarProps {
  percentage: number;
  label: string;
}

export function UptimeBar({ percentage, label }: UptimeBarProps) {
  let barColor = "bg-status-up";
  if (percentage < 99) barColor = "bg-status-degraded";
  if (percentage < 95) barColor = "bg-status-down";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <span className="text-xs font-medium text-text-secondary">
          {percentage}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-sm bg-navy-lighter overflow-hidden">
        <div
          className={`h-full rounded-sm ${barColor} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
