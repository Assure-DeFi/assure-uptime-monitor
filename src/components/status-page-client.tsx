"use client";

import { useState } from "react";

export function StatusPageClient() {
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function runCheck() {
    setIsChecking(true);
    setLastResult(null);
    try {
      const response = await fetch("/api/monitors/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.success) {
        setLastResult(`Checked ${data.checked} monitors`);
        // Reload page to show updated results
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setLastResult("Check failed");
      }
    } catch {
      setLastResult("Error running checks");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {lastResult && (
        <span className="text-xs text-text-muted">{lastResult}</span>
      )}
      <button
        onClick={runCheck}
        disabled={isChecking}
        className="px-3 py-1.5 text-xs font-medium bg-gold text-navy rounded-sm hover:bg-gold-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isChecking ? "Checking..." : "Run Check"}
      </button>
    </div>
  );
}
