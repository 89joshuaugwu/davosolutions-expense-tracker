import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { ExpenseList } from "@/components/expenses/expense-list";

export default async function ExpensesPage() {
  await requireUser();

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Expenses</h1>
          <p>Every expense, with the details that matter.</p>
        </div>
        <Link className="button primary" href="/expenses/new">
          <Plus size={16} /> Record expense
        </Link>
      </div>
      <ExpenseList />
    </>
  );
}
