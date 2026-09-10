import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { MonthlyFundsService } from "@/features/monthly-funds/service";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const funds = await MonthlyFundsService.getMonthlyFunds(user);
    return NextResponse.json({ funds });
  } catch (error: any) {
    console.error("GET /api/monthly-funds error:", error);
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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
    const result = await MonthlyFundsService.createMonthlyFund(user, body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/monthly-funds error:", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message.includes("already exists") || message.includes("idempotency")) {
      return NextResponse.json({ error: "Conflict: " + message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
