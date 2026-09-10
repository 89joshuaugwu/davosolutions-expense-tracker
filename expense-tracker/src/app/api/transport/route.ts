import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { TransportService } from "@/features/transport/service";
import { ZodError } from "zod";
import { canCreateOperationalRecord } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;
    const cursor = searchParams.get("cursor") || undefined;

    const { logs, nextCursor } = await TransportService.getLogs(user, month, cursor);
    return NextResponse.json({ logs, nextCursor });
  } catch (error) {
    console.error("GET /api/transport error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canCreateOperationalRecord(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Protect against CSRF by enforcing origin
    const origin = request.headers.get("origin");
    if (origin !== process.env.APP_URL) {
      return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
    }

    const body = await request.json();
    const result = await TransportService.logTransport(user, body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/transport error:", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    // Check for conflict
    if (message.includes("idempotency")) {
      return NextResponse.json({ error: "Conflict" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
