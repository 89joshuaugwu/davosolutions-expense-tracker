import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { DashboardService } from "@/features/dashboard/service";
import { canViewOperationalTotals } from "@/lib/auth/permissions";
import { assertReportingMonth, currentReportingMonth } from "@/domain/dates";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  
  // Use current month if not provided, else use the provided month
  // Validate basic format YYYY-MM
  let month = currentReportingMonth();
  if (monthParam) {
    try {
      assertReportingMonth(monthParam);
      month = monthParam;
    } catch {
      return NextResponse.json({ error: "Month must use YYYY-MM." }, { status: 400 });
    }
  }

  try {
    let analytics = null;
    if (canViewOperationalTotals(user)) {
      analytics = await DashboardService.getAnalytics(user, month as any);
    }

    const activity = await DashboardService.getRecentActivity(user);

    return NextResponse.json({
      analytics,
      recentActivity: activity,
      month,
    });
  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
