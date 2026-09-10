import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canCreateOperationalRecord } from "@/lib/auth/permissions";
import { getAdminDb } from "@/lib/firebase/admin";
import { NewSalaryForm } from "@/components/salaries/new-salary-form";
import type { Category } from "@/domain/models";

export const metadata = {
  title: "Log Salary | Davo Solutions",
};

export default async function NewSalaryPage() {
  const user = await getSessionUser();
  if (!user || user.status !== "active") redirect("/login");
  
  if (!canCreateOperationalRecord(user)) {
    redirect("/salaries");
  }

  const db = getAdminDb();
  
  // Fetch required reference data
  const [settingsSnap, categoriesSnap] = await Promise.all([
    db.collection("settings").doc("company").get(),
    db.collection("categories").where("isActive", "==", true).get(),
  ]);

  const settings = settingsSnap.data();
  if (!settings) {
    throw new Error("Company settings missing");
  }

  const categories = categoriesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Category))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="py-6">
      <NewSalaryForm
        categories={categories}
        baseCurrency={settings.baseCurrency}
        enabledCurrencies={settings.enabledCurrencies || [settings.baseCurrency]}
        userRole={user.role as "super_admin" | "secretary"}
      />
    </div>
  );
}
