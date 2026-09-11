import { BillDetail } from "@/components/bills/bill-detail";
import { requireUser } from "@/lib/auth/session";
import { canViewOperationalKind, isSuperAdmin } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Bill Detail | Davo Solutions",
};

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canViewOperationalKind(user, "bill")) redirect("/dashboard?access=denied");
  const superAdmin = isSuperAdmin(user);

  return (
    <div className="page-stack">
      <BillDetail id={id} isSuperAdmin={superAdmin} />
    </div>
  );
}
