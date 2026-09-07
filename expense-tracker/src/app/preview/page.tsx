import { AppShell } from "@/components/app-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { PreviewDashboard } from "@/components/preview/dashboard";
import { MonthControl, PreviewNotice } from "@/components/preview/controls";
import { ExpenseTable } from "@/components/preview/expense-table";
import { previewExpenses } from "@/lib/preview/fixtures";
import { isSection, navigation, type Section } from "@/lib/navigation";

export const metadata = { title: "Design preview" };
// This page never calls Firebase or accepts real user data. The role is for public sample rendering only.
export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ role?: string; section?: string; month?: string }> }) {
  const params = await searchParams;
  const role = params.role === "secretary" ? "secretary" : "super_admin";
  const month = ["2026-09", "2026-08", "2026-07"].includes(params.month ?? "") ? params.month! : "2026-09";
  const sections: Section[] = role === "super_admin" ? navigation.map((item) => item.key) : ["dashboard", "expenses", "salaries", "transport", "bills"];
  const requested = params.section && isSection(params.section) ? params.section : "dashboard";
  const section = sections.includes(requested) ? requested : "dashboard";
  return <AppShell role={role} name={role === "super_admin" ? "Davo Admin" : "Amara Okafor"} sections={sections} preview section={section} month={month}><PreviewNotice role={role} section={section} month={month} />{section === "dashboard" ? <PreviewDashboard role={role} month={month} /> : section === "expenses" ? <><div className="page-heading"><div><p className="eyebrow">YOUR EXPENSE REGISTER</p><h1>Small details. Clear records.</h1><p>{role === "secretary" ? "Your submitted sample expenses, all in one place." : "A closer look at your company’s everyday spending."}</p></div><MonthControl role={role} section={section} month={month} /></div><section className="panel"><div className="panel-heading"><div><h2>{role === "secretary" ? "Your submissions" : "All expenses"}</h2><p>Select an expense to view its sample details.</p></div><span className="badge neutral">Read-only preview</span></div><ExpenseTable key={`${role}-${month}`} rows={previewExpenses(month, role === "secretary")} /></section></> : <ModulePlaceholder section={section} preview />}</AppShell>;
}
