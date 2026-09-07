import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireUser } from "@/lib/auth/session";

export default async function NewOperationalPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section !== "salaries" && section !== "transport" && section !== "bills") notFound();
  await requireUser();
  return <ModulePlaceholder section={section} />;
}
