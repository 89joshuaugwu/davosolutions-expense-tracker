import type { UserProfile } from "./model";

export type OperationalKind = "expense" | "salary" | "transport" | "bill";
export interface OperationalRecordAccess {
  id: string;
  kind: OperationalKind;
  createdBy: string;
  visibleToUserIds: readonly string[];
}

export function isSuperAdmin(user: UserProfile): boolean {
  return user.status === "active" && user.role === "super_admin";
}

export function canCreateOperationalRecord(user: UserProfile): boolean {
  return user.status === "active" && ["super_admin", "secretary"].includes(user.role);
}

export function canViewOperationalKind(user: UserProfile, kind: OperationalKind): boolean {
  if (user.status !== "active") return false;
  if (isSuperAdmin(user)) return true;
  if (user.role !== "secretary") return false;
  switch (kind) {
    case "expense": return true;
    case "salary": return user.permissions.viewSalaries;
    case "transport": return user.permissions.viewTransport;
    case "bill": return user.permissions.viewBills;
    default: return false;
  }
}

export function canViewOperationalRecord(user: UserProfile, record: OperationalRecordAccess): boolean {
  if (!canViewOperationalKind(user, record.kind)) return false;
  return isSuperAdmin(user) || record.createdBy === user.uid || record.visibleToUserIds.includes(user.uid);
}

/** Submitted operational records are immutable for secretaries, even their own. */
export function canCorrectOperationalRecord(user: UserProfile): boolean {
  return isSuperAdmin(user);
}

export function canViewOperationalTotals(user: UserProfile): boolean {
  return isSuperAdmin(user) || (user.status === "active" && user.role === "secretary" && user.permissions.viewOperationalTotals);
}

const adminPaths = new Set(["/monthly-funds", "/revenue", "/profit-loss", "/reports", "/audit-log", "/users", "/settings"]);

/** Navigation helper only. Every protected server data operation must authorize again. */
export function canAccessRoute(user: UserProfile, pathname: string): boolean {
  if (user.status !== "active") return false;
  const root = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  if (adminPaths.has(root)) return isSuperAdmin(user);
  if (root === "/salaries") return pathname === "/salaries/new" ? canCreateOperationalRecord(user) : canViewOperationalKind(user, "salary");
  if (root === "/transport") return pathname === "/transport/new" ? canCreateOperationalRecord(user) : canViewOperationalKind(user, "transport");
  if (root === "/bills") return pathname === "/bills/new" ? canCreateOperationalRecord(user) : canViewOperationalKind(user, "bill");
  return ["/dashboard", "/expenses"].includes(root) && canCreateOperationalRecord(user);
}
