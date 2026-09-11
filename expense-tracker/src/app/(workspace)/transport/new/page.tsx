import { NewTransportForm } from "@/components/transport/new-transport-form";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { canCreateOperationalRecord } from "@/lib/auth/permissions";
import { getCompanySettings } from "@/lib/server/repositories/settings";
import { getAdminDb } from "@/lib/firebase/admin";
import Link from "next/link";

export const metadata = {
  title: "Log Transport | Davo Expenses",
};

export default async function NewTransportPage() {
  const user = await requireUser();
  if (!canCreateOperationalRecord(user)) redirect("/dashboard?access=denied");
  const settings = await getCompanySettings();
  if (!settings) {
    throw new Error("Settings not found");
  }

  // Fetch active transport categories
  const db = getAdminDb();
  const categoriesSnap = await db
    .collection("categories")
    .where("isActive", "==", true)
    .where("applicableTo", "array-contains", "transport")
    .get();

  const categories = categoriesSnap.docs.map(doc => ({
    id: doc.id,
    name: String(doc.data().name),
  }));

  if (categories.length === 0) {
    return <section className="panel state-panel setup-state">
      <p className="eyebrow">SETUP REQUIRED</p>
      <h1>Add a transport category first</h1>
      <p>Transport records must use an active category. Create one in Settings before logging this entry.</p>
      <Link className="button primary" href="/settings">Open settings</Link>
    </section>;
  }

  return (
    <>
      <NewTransportForm 
        categories={categories} 
        baseCurrency={settings.baseCurrency} 
      />
    </>
  );
}
