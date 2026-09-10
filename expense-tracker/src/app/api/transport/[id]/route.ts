import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { TransportService } from "@/features/transport/service";
import { ZodError } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const log = await TransportService.getLogDetail(user, id);
    if (!log) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(log);
  } catch (error) {
    console.error("GET /api/transport/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin = request.headers.get("origin");
    if (origin !== process.env.APP_URL) {
      return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
    }

    const body = await request.json();
    await TransportService.correctLog(user, id, body);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/transport/[id] error:", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Conflict") || message.includes("already archived")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("Not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("Super Admin")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
