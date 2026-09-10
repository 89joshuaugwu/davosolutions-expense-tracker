import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { BillsService } from "@/features/bills/service";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as "active" | "paused" | "completed" | undefined;

    const bills = await BillsService.getBills(user, status);
    return NextResponse.json({ bills });
  } catch (error) {
    console.error("GET /api/bills error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin = request.headers.get("origin");
    if (origin !== process.env.APP_URL) {
      return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
    }

    const body = await request.json();
    const result = await BillsService.createBill(user, body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/bills error:", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("idempotency")) {
      return NextResponse.json({ error: "Conflict" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
