import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/session";
import { ReportsCenter } from "@/components/reports/reports-center";
import { DashboardService } from "@/features/dashboard/service";
import { currentReportingMonth } from "@/domain/dates";

export const metadata: Metadata = {
  title: "Reports | Davo Solutions",
};

export default async function ReportsPage() {
  const user = await requireSuperAdmin();
  const month = currentReportingMonth();
  const analytics = await DashboardService.getAnalytics(user, month);
  return <ReportsCenter initialMonth={month} initialAnalytics={analytics} />;
}
