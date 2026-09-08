import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";
import type { Category } from "../../../domain/models";
import type { ExpenseKind } from "../../../domain/models";

/**
 * Default categories seeded on first use.
 * Sort order is the position in the dropdown (ascending).
 */
const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "General", type: "general", status: "active", sortOrder: 1 },
  { name: "Office & Supplies", type: "general", status: "active", sortOrder: 2 },
  { name: "Utilities", type: "general", status: "active", sortOrder: 3 },
  { name: "Transport", type: "transport", status: "active", sortOrder: 4 },
  { name: "Salaries", type: "salary", status: "active", sortOrder: 5 },
  { name: "Bills & Subscriptions", type: "bill", status: "active", sortOrder: 6 },
  { name: "Other", type: "other", status: "active", sortOrder: 7 },
];

function docToCategory(id: string, data: FirebaseFirestore.DocumentData): Category {
  return {
    id,
    name: typeof data["name"] === "string" ? data["name"] : "Unknown",
    type: (data["type"] as ExpenseKind) ?? "general",
    status: data["status"] === "archived" ? "archived" : "active",
    sortOrder: typeof data["sortOrder"] === "number" ? data["sortOrder"] : 99,
  };
}

/**
 * Returns all active categories, sorted by sortOrder.
 * Seeds defaults if the collection is empty.
 */
export async function getActiveCategories(): Promise<Category[]> {
  const db = getAdminDb();
  const snapshot = await db.collection("categories").where("status", "==", "active").orderBy("sortOrder").get();

  if (!snapshot.empty) {
    return snapshot.docs.map((doc) => docToCategory(doc.id, doc.data()));
  }

  // First run — seed defaults atomically
  const batch = db.batch();
  const seeded: Category[] = [];
  for (const cat of DEFAULT_CATEGORIES) {
    const ref = db.collection("categories").doc();
    batch.set(ref, { ...cat, createdAt: FieldValue.serverTimestamp() });
    seeded.push({ id: ref.id, ...cat });
  }
  await batch.commit();
  return seeded;
}

/**
 * Returns a single active category by ID.
 * Returns null if not found or archived (archived IDs remain on historical records but cannot be
 * selected for new entries).
 */
export async function getActiveCategoryById(id: string): Promise<Category | null> {
  if (!id || id.includes("/")) return null;
  const db = getAdminDb();
  const snapshot = await db.collection("categories").doc(id).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data()!;
  if (data["status"] !== "active") return null;
  return docToCategory(snapshot.id, data);
}

/**
 * Reads a category inside a transaction, for use within atomic writes.
 */
export async function getCategoryInTransaction(
  transaction: FirebaseFirestore.Transaction,
  id: string,
): Promise<Category | null> {
  if (!id || id.includes("/")) return null;
  const db = getAdminDb();
  const snapshot = await transaction.get(db.collection("categories").doc(id));
  if (!snapshot.exists) return null;
  const data = snapshot.data()!;
  if (data["status"] !== "active") return null;
  return docToCategory(snapshot.id, data);
}
