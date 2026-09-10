import { TransportList } from "@/components/transport/transport-list";
import { requireUser } from "@/lib/auth/session";

export const metadata = {
  title: "Transport Register | Davo Expenses",
};

export default async function TransportPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <TransportList />
    </div>
  );
}
