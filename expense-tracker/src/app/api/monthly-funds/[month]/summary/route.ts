import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { MonthlyFundsService } from "@/features/monthly-funds/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month } = await params;
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await MonthlyFundsService.getMonthlySummary(user, month);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/monthly-funds/[month]/summary error:", error);
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
