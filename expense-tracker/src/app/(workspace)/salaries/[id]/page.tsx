import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canViewOperationalKind, isSuperAdmin } from "@/lib/auth/permissions";
import { SalaryDetail } from "@/components/salaries/salary-detail";

export const metadata = {
  title: "Salary Record | Davo Solutions",
};

export default async function SalaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || user.status !== "active") redirect("/login");
  
  if (!canViewOperationalKind(user, "salary")) {
    redirect("/salaries");
  }

  return (
    <div className="py-6">
      <SalaryDetail salaryId={id} isSuperAdmin={isSuperAdmin(user)} />
    </div>
  );
}
