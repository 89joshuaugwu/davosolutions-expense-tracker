import "server-only";

import { getAdminDb } from "../../firebase/admin";
import type { RevenueSource } from "../../../domain/models";

export async function getRevenueSources(includeArchived = false): Promise<RevenueSource[]> {
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("revenueSources").orderBy("sortOrder", "asc").orderBy("name", "asc");

  if (!includeArchived) {
    query = query.where("status", "==", "active");
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: String(doc.data().name ?? ""),
    status: doc.data().status === "archived" ? "archived" : "active",
    sortOrder: Number(doc.data().sortOrder ?? 0),
  }));
}

export async function getRevenueSource(id: string): Promise<RevenueSource | null> {
  if (!id || id.includes("/")) return null;
  const db = getAdminDb();
  const snapshot = await db.collection("revenueSources").doc(id).get();
  if (!snapshot.exists) return null;
  return {
    id: snapshot.id,
    name: String(snapshot.data()!.name ?? ""),
    status: snapshot.data()!.status === "archived" ? "archived" : "active",
    sortOrder: Number(snapshot.data()!.sortOrder ?? 0),
  };
}

export async function createRevenueSource(
  name: string,
  sortOrder: number,
  status: "active" | "archived" = "active"
): Promise<RevenueSource> {
  const db = getAdminDb();
  const ref = db.collection("revenueSources").doc();
  const source: RevenueSource = {
    id: ref.id,
    name,
    status,
    sortOrder,
  };
  await ref.set(source);
  return source;
}

export async function updateRevenueSource(
  id: string,
  updates: Partial<Pick<RevenueSource, "name" | "status" | "sortOrder">>
): Promise<void> {
  if (!id || id.includes("/")) throw new Error("Invalid ID");
  const db = getAdminDb();
  await db.collection("revenueSources").doc(id).update(updates);
}
