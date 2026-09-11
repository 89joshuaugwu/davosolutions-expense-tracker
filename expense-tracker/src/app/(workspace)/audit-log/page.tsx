import { requireSuperAdmin } from "@/lib/auth/session";
import { AuditLogList } from "@/components/audit/audit-log-list";

export const metadata = {
  title: "Audit Trail | Davo Solutions",
};

export default async function AuditLogPage() {
  await requireSuperAdmin();
  return <AuditLogList />;
}
