import { requireSuperAdmin } from "@/lib/auth/session";
import { UserList } from "@/components/users/user-list";

export const metadata = {
  title: "Team & Access | Davo Solutions",
};

export default async function UsersPage() {
  await requireSuperAdmin();
  return <UserList />;
}
