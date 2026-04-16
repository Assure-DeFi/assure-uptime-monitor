import { NextRequest, NextResponse } from "next/server";
import { runChecksForPriority, seedMonitors } from "@/lib/checker";
import { cleanOldCheckResults } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized triggers
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    seedMonitors();

    // Determine which priority to check based on query param or run all
    const searchParams = request.nextUrl.searchParams;
    const priority = searchParams.get("priority") ?? undefined;

    const result = await runChecksForPriority(priority);

    // Clean old results once per day (when running full checks)
    if (!priority) {
      cleanOldCheckResults(90);
    }

    return NextResponse.json({
      success: true,
      checked: result.checked,
      results: result.results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron check error:", error);
    return NextResponse.json({ error: "Cron check failed" }, { status: 500 });
  }
}
