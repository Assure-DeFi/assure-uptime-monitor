import { NextRequest, NextResponse } from "next/server";
import { runChecksForPriority, seedMonitors } from "@/lib/checker";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await seedMonitors();

    const body = await request.json().catch(() => ({}));
    const priority =
      typeof body === "object" && body !== null && "priority" in body
        ? (body as { priority?: string }).priority
        : undefined;

    const result = await runChecksForPriority(priority);

    return NextResponse.json({
      success: true,
      checked: result.checked,
      results: result.results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error running checks:", error);
    return NextResponse.json(
      { error: "Failed to run checks" },
      { status: 500 },
    );
  }
}
