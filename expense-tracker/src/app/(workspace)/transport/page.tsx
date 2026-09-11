import { TransportList } from "@/components/transport/transport-list";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { canViewOperationalKind } from "@/lib/auth/permissions";

export const metadata = {
  title: "Transport Register | Davo Expenses",
};

export default async function TransportPage() {
  const user = await requireUser();
  if (!canViewOperationalKind(user, "transport")) redirect("/dashboard?access=denied");

  return (
    <div className="page-stack">
      <TransportList />
    </div>
  );
}
