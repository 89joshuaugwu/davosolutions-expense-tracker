import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { BillsService } from "@/features/bills/service";
import { ZodError } from "zod";

export async function POST(
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
    const result = await BillsService.payBill(user, id, body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/bills/[id]/payments error:", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("already paid") || message.includes("idempotency")) {
      return NextResponse.json({ error: "Conflict: " + message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
