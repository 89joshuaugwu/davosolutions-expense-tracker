import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard | Davo Solutions",
};

export default async function DashboardPage() {
  const user = await requireUser();
  return <DashboardView userRole={user.role} userName={user.name} />;
}
