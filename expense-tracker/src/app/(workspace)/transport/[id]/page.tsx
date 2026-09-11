import { TransportDetail } from "@/components/transport/transport-detail";
import { requireUser } from "@/lib/auth/session";
import { canViewOperationalKind } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Transport Detail | Davo Expenses",
};

export default async function TransportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canViewOperationalKind(user, "transport")) redirect("/dashboard?access=denied");
  
  return (
    <div className="page-stack">
      <TransportDetail id={id} isSuperAdmin={user.role === "super_admin"} />
    </div>
  );
}
