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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Salary Register</h1>
          <p className="text-sm text-gray-500 mt-1">Manage staff salaries and wages.</p>
        </div>
        {canCreate && (
          <Link
            href="/salaries/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Log Salary
          </Link>
        )}
      </div>

      <SalaryList />
    </div>
  );
}
