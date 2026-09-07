import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireUser } from "@/lib/auth/session";

export default async function NewExpensePage() { await requireUser(); return <ModulePlaceholder section="expenses" />; }
