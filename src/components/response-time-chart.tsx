"use client";

interface DataPoint {
  response_time_ms: number | null;
  status: string;
  checked_at: string;
}

interface ResponseTimeChartProps {
  data: DataPoint[];
  height?: number;
}

export function ResponseTimeChart({
  data,
  height = 60,
}: ResponseTimeChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-xs"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  // Take last 50 points, reversed to chronological
  const points = data.slice(0, 50).reverse();
  const times = points
    .map((p) => p.response_time_ms)
    .filter((t): t is number => t !== null);

  if (times.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-xs"
        style={{ height }}
      >
        No response time data
      </div>
    );
  }

  const maxTime = Math.max(...times, 100);
  const barWidth = Math.max(2, Math.floor(200 / points.length));

  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {points.map((point, i) => {
        const value = point.response_time_ms ?? 0;
        const barHeight = Math.max(2, (value / maxTime) * height);

        let barColor = "bg-status-up";
        if (point.status === "down") barColor = "bg-status-down";
        else if (point.status === "degraded") barColor = "bg-status-degraded";
        else if (value > 2000) barColor = "bg-status-degraded";

        return (
          <div
            key={`${point.checked_at}-${i}`}
            className={`${barColor} rounded-t-sm opacity-80 hover:opacity-100 transition-opacity`}
            style={{ width: barWidth, height: barHeight }}
            title={`${value}ms at ${point.checked_at}`}
          />
        );
      })}
    </div>
  );
}
