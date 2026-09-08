import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { ExpenseDetail } from "@/components/expenses/expense-detail";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Expense detail</h1>
        </div>
        <Link className="button secondary" href="/expenses">
          <ArrowLeft size={16} /> Back to expenses
        </Link>
      </div>
      <ExpenseDetail expenseId={id} isSuperAdmin={isSuperAdmin(user)} />
    </>
  );
}
