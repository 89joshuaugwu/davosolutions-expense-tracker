"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, FlaskConical } from "lucide-react";
import type { Section } from "@/lib/navigation";

export function PreviewNotice({ role, section, month }: { role: "super_admin" | "secretary"; section: Section; month: string }) {
  return <div className="preview-notice"><div><FlaskConical size={17} /><p><strong>Design preview</strong><span> Fictional data. Changes are never saved.</span></p></div><div className="role-switch" aria-label="Preview role"><Link aria-current={role === "super_admin" ? "page" : undefined} className={role === "super_admin" ? "selected" : ""} href={`/preview?role=super_admin&section=${section}&month=${month}`}>Super Admin</Link><Link aria-current={role === "secretary" ? "page" : undefined} className={role === "secretary" ? "selected" : ""} href={`/preview?role=secretary&section=dashboard&month=${month}`}>Secretary</Link></div></div>;
}

export function MonthControl({ role, section, month }: { role: string; section: Section; month: string }) {
  const router = useRouter();
  return <div className="month-control"><CalendarDays size={17} /><select aria-label="Reporting month" value={month} onChange={(event) => router.push(`/preview?role=${role}&section=${section}&month=${event.target.value}`)}><option value="2026-09">September 2026</option><option value="2026-08">August 2026</option><option value="2026-07">July 2026 · empty state</option></select></div>;
}
