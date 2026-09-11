import { Metadata } from "next";
import { ProfitLossView } from "@/components/dashboard/profit-loss-view";
import { requireSuperAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Profit & Loss | Davo Solutions",
};

export default async function ProfitLossPage() {
  await requireSuperAdmin();
  return <ProfitLossView />;
}
