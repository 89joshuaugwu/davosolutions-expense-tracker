import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { DashboardService } from "@/features/dashboard/service";
import { canViewOperationalTotals } from "@/lib/auth/permissions";
import { currentReportingMonth, reportingMonthOf } from "@/domain/dates";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  
  // Use current month if not provided, else use the provided month
  // Validate basic format YYYY-MM
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) 
    ? monthParam 
    : reportingMonthOf(new Date().toISOString().split("T")[0]);

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
