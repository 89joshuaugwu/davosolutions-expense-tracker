import { MonthlyReconciliation } from "@/components/monthly-funds/monthly-reconciliation";

export const metadata = {
  title: "Monthly Reconciliation | Davo Solutions",
};

export default async function MonthlyReconciliationPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  
  return (
    <div className="max-w-6xl mx-auto py-8">
      <MonthlyReconciliation month={month} />
    </div>
  );
}
