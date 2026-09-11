import { NewBillForm } from "@/components/bills/new-bill-form";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canCreateOperationalRecord } from "@/lib/auth/permissions";

export const metadata = {
  title: "New Bill | Davo Solutions",
};

export default async function NewBillPage() {
  const user = await requireUser();
  if (!canCreateOperationalRecord(user)) redirect("/dashboard?access=denied");
  return (
    <div className="page-stack narrow-page">
      <NewBillForm />
    </div>
  );
}
