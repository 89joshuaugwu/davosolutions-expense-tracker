import { MonthlyFundsList } from "@/components/monthly-funds/monthly-funds-list";

export const metadata = {
  title: "Monthly Funds | Davo Solutions",
};

export default function MonthlyFundsPage() {
  return (
    <div className="max-w-6xl mx-auto py-8">
      <MonthlyFundsList />
    </div>
  );
}
