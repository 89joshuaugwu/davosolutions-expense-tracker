import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, LockKeyhole, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
  const user = await requireUser();
  const { access } = await searchParams;
  return <><div className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Welcome, {user.name.split(" ")[0]}.</h1><p>{user.role === "super_admin" ? "Your financial workspace starts here." : "Your day-to-day expense workspace starts here."}</p></div></div>{access === "denied" && <p className="notice" role="alert"><LockKeyhole size={18} /> You don’t have access to that page.</p>}<div className="quick-actions">{[{ route: "expenses", label: "General expense" }, { route: "salaries", label: "Salary payment" }, { route: "transport", label: "Transportation" }, { route: "bills", label: "Bill payment" }].map(({ route, label }) => <Link className="panel quick-action" href={`/${route}/new`} key={route}><Plus size={20} /><strong>{label}</strong><p>Entry workflow coming soon</p><span>View workspace <ArrowUpRight size={15} /></span></Link>)}</div><section className="panel module-placeholder"><span className="empty-icon"><ClipboardCheck size={30} /></span><span className="badge success">Account connected</span><h2>Your workspace foundation is in place.</h2><p>Financial entry forms and reporting are still being connected. Explore the design preview to review the planned experience with fictional data.</p><Link className="button primary" href={`/preview?role=${user.role}`}>Explore the preview <ArrowUpRight size={16} /></Link></section></>;
}
