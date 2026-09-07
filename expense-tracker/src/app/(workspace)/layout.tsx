import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { canAccessRoute } from "@/lib/auth/permissions";
import { navigation } from "@/lib/navigation";

export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell name={user.name} role={user.role} sections={navigation.filter((item) => canAccessRoute(user, `/${item.key}`)).map((item) => item.key)}>{children}</AppShell>;
}
