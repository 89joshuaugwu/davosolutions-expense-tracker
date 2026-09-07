"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { navigation, type Section } from "@/lib/navigation";

type Props = { children: React.ReactNode; role: "super_admin" | "secretary"; name: string; sections: Section[]; preview?: boolean; section?: Section; month?: string };

export function AppShell({ children, role, name, sections, preview = false, section, month = "2026-09" }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const active = section ?? pathname.split("/")[1];
  const href = (key: Section) => preview ? `/preview?role=${role}&section=${key}&month=${month}` : `/${key}`;

  async function logout() {
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE", headers: { "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("Unable to sign out. Please try again.");
      // A full document navigation discards cached protected client state after logout.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign out."); setSigningOut(false); }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {mobileOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Main navigation">
      <Link href={href("dashboard")} className="brand-link" aria-label="Davo Expenses home"><Brand /></Link>
      <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
      <div className="workspace-label"><span className="workspace-avatar">DS</span><div><strong>Davo Solutions</strong><small>Company workspace</small></div><ChevronDown size={14} aria-hidden="true" /></div>
      <nav>{(["Workspace", "Finance", "Administration"] as const).map((group) => {
        const items = navigation.filter((item) => item.group === group && sections.includes(item.key));
        return items.length > 0 && <div className="nav-group" key={group}><p>{group}</p>{items.map(({ key, icon: Icon, label }) => <Link key={key} href={href(key)} className={`nav-link ${active === key ? "active" : ""}`} aria-current={active === key ? "page" : undefined} onClick={() => setMobileOpen(false)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span>{key === "bills" && preview && <span className="nav-count">3</span>}</Link>)}</div>;
      })}</nav>
      <div className="sidebar-bottom"><div className="access-note"><ShieldCheck size={18} /><div><strong>{role === "super_admin" ? "Super Admin access" : "Secretary access"}</strong><small>{preview ? "Sample workspace" : "Private company workspace"}</small></div></div><div className="profile"><span className="avatar">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{name}</strong><small>{role === "super_admin" ? "Super Administrator" : "Secretary"}</small></div>{preview ? <Link className="icon-button" href="/login" aria-label="Go to sign in"><ArrowUpRight size={18} /></Link> : <button className="icon-button" aria-label="Sign out" disabled={signingOut} onClick={logout}><LogOut size={18} /></button>}</div>{error && <p className="form-error" role="alert">{error}</p>}</div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={21} /></button><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{navigation.find((item) => item.key === active)?.label ?? "Overview"}</strong></div><div className="topbar-right"><span className="private-label"><span className="status-dot" />{preview ? "Design preview" : "Internal workspace"}</span><span className="topbar-divider" /><span className="avatar small">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span></div></header>
      <main id="main-content" className="main-content">{children}</main><footer className="app-footer"><span>© {new Date().getFullYear()} Davo Solutions</span><span>Expenses & Profit Tracker <span className="footer-dot">·</span> Foundation v0.1</span></footer>
    </div>
  </div>;
}
