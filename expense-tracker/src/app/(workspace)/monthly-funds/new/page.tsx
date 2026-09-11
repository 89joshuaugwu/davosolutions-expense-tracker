import { NewFundForm } from "@/components/monthly-funds/new-fund-form";
import { requireSuperAdmin } from "@/lib/auth/session";

export const metadata = {
  title: "New Monthly Fund | Davo Solutions",
};

export default async function NewMonthlyFundPage() {
  await requireSuperAdmin();
  return (
    <>
      <NewFundForm />
    </>
  );
}
