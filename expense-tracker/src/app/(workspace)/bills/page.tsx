import { BillList } from "@/components/bills/bill-list";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canViewOperationalKind } from "@/lib/auth/permissions";

export const metadata = {
  title: "Bills | Davo Solutions",
};

export default async function BillsPage() {
  const user = await requireUser();
  if (!canViewOperationalKind(user, "bill")) redirect("/dashboard?access=denied");
  return (
    <div className="page-stack">
      <BillList />
    </div>
  );
}
