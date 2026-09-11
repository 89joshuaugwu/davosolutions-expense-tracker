import { MonthlyReconciliation } from "@/components/monthly-funds/monthly-reconciliation";
import { requireSuperAdmin } from "@/lib/auth/session";

export const metadata = {
  title: "Monthly Reconciliation | Davo Solutions",
};

export default async function MonthlyReconciliationPage({ params }: { params: Promise<{ month: string }> }) {
  await requireSuperAdmin();
  const { month } = await params;
  
  return (
    <div className="page-stack">
      <MonthlyReconciliation month={month} />
    </div>
  );
}
