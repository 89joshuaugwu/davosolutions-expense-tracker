import { NewTransportForm } from "@/components/transport/new-transport-form";
import { requireUser } from "@/lib/auth/session";
import { getCompanySettings } from "@/lib/server/repositories/settings";
import { getAdminDb } from "@/lib/firebase/admin";

export const metadata = {
  title: "Log Transport | Davo Expenses",
};

export default async function NewTransportPage() {
  await requireUser();
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

  // Fallback if none configured
  if (categories.length === 0) {
    categories.push({ id: "transport-default", name: "General Transport" });
    // Note: In reality, we'd want a UI prompt to add categories first
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
