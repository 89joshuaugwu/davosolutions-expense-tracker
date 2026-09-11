import { MonthlyFundsList } from "@/components/monthly-funds/monthly-funds-list";
import { requireSuperAdmin } from "@/lib/auth/session";

export const metadata = {
  title: "Monthly Funds | Davo Solutions",
};

export default async function MonthlyFundsPage() {
  await requireSuperAdmin();
  return (
    <>
      <MonthlyFundsList />
    </>
  );
}
