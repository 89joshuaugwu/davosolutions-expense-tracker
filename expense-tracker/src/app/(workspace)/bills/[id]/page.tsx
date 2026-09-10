import { BillDetail } from "@/components/bills/bill-detail";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";

export const metadata = {
  title: "Bill Detail | Davo Solutions",
};

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const superAdmin = user ? isSuperAdmin(user) : false;

  return (
    <div className="max-w-6xl mx-auto py-8">
      <BillDetail id={id} isSuperAdmin={superAdmin} />
    </div>
  );
}
