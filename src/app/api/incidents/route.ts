import { NextRequest, NextResponse } from "next/server";
import { getAllIncidents, createIncident } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const incidents = getAllIncidents(100);
    return NextResponse.json({
      incidents,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return NextResponse.json(
      { error: "Failed to fetch incidents" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || !("title" in body)) {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 },
      );
    }

    const { title, description, monitor_id, severity } = body as {
      title: string;
      description?: string;
      monitor_id?: string;
      severity?: string;
    };

    if (severity && !["critical", "major", "minor"].includes(severity)) {
      return NextResponse.json(
        { error: "Invalid severity. Must be: critical, major, or minor" },
        { status: 400 },
      );
    }

    const incident = createIncident({
      title,
      description,
      monitor_id,
      severity,
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    console.error("Error creating incident:", error);
    return NextResponse.json(
      { error: "Failed to create incident" },
      { status: 500 },
    );
  }
}
