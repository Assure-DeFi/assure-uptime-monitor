import { NextRequest, NextResponse } from "next/server";
import { getIncidentById, updateIncident } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const incidentId = parseInt(id, 10);

    if (isNaN(incidentId)) {
      return NextResponse.json(
        { error: "Invalid incident ID" },
        { status: 400 },
      );
    }

    const incident = getIncidentById(incidentId);
    if (!incident) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ incident });
  } catch (error) {
    console.error("Error fetching incident:", error);
    return NextResponse.json(
      { error: "Failed to fetch incident" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const incidentId = parseInt(id, 10);

    if (isNaN(incidentId)) {
      return NextResponse.json(
        { error: "Invalid incident ID" },
        { status: 400 },
      );
    }

    const existing = getIncidentById(incidentId);
    if (!existing) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { status, description } = body as {
      status?: string;
      description?: string;
    };

    if (
      status &&
      !["investigating", "identified", "monitoring", "resolved"].includes(
        status,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Must be: investigating, identified, monitoring, or resolved",
        },
        { status: 400 },
      );
    }

    const updates: {
      status?: string;
      resolved_at?: string;
      description?: string;
    } = {};
    if (status) updates.status = status;
    if (description) updates.description = description;
    if (status === "resolved") updates.resolved_at = new Date().toISOString();

    const updated = updateIncident(incidentId, updates);

    return NextResponse.json({ incident: updated });
  } catch (error) {
    console.error("Error updating incident:", error);
    return NextResponse.json(
      { error: "Failed to update incident" },
      { status: 500 },
    );
  }
}
