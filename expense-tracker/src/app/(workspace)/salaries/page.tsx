import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canViewOperationalKind, canCreateOperationalRecord } from "@/lib/auth/permissions";
import { SalaryList } from "@/components/salaries/salary-list";
import Link from "next/link";
import { Plus } from "lucide-react";

export const metadata = {
  title: "Salaries | Davo Solutions",
};

export default async function SalariesPage() {
  const user = await getSessionUser();
  if (!user || user.status !== "active") redirect("/login");
  
  if (!canViewOperationalKind(user, "salary")) {
    return (
      <div className="p-8 text-center text-gray-500">
        You do not have permission to view salaries.
      </div>
    );
  }

  const canCreate = canCreateOperationalRecord(user);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Salary Register</h1>
          <p>Manage staff salaries and wages.</p>
        </div>
        {canCreate && (
          <div className="heading-actions">
            <Link className="button primary" href="/salaries/new">
              <Plus size={16} /> Log Salary
            </Link>
          </div>
        )}
      </div>

      <SalaryList />
    </>
  );
}
