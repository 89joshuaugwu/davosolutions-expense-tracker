import { notFound, redirect } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireUser } from "@/lib/auth/session";
import { canAccessRoute } from "@/lib/auth/permissions";
import { isSection } from "@/lib/navigation";

export default async function ModulePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  const user = await requireUser();
  if (!canAccessRoute(user, `/${section}`)) redirect("/dashboard?access=denied");
  return <ModulePlaceholder section={section} />;
}
