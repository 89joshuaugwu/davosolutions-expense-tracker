import { TransportDetail } from "@/components/transport/transport-detail";
import { requireUser } from "@/lib/auth/session";

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
  
  return (
    <div className="space-y-6">
      <TransportDetail id={id} isSuperAdmin={user.role === "super_admin"} />
    </div>
  );
}
