import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

/** GET /api/categories — List all categories (active + archived for admin) */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const db = getAdminDb();
    const snapshot = await db.collection("categories").orderBy("sortOrder").get();
    const categories = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name ?? "Unknown",
      type: doc.data().type ?? "general",
      status: doc.data().status ?? "active",
      sortOrder: doc.data().sortOrder ?? 99,
    }));

    return NextResponse.json({ categories });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to list categories" }, { status: 500 });
  }
}

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  type: z.enum(["general", "salary", "transport", "bill", "other"]),
  sortOrder: z.number().int().min(1).max(999).optional(),
});

/** POST /api/categories — Create a new category (Super Admin only) */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const db = getAdminDb();

    // Auto-assign sortOrder if not provided
    let sortOrder = parsed.data.sortOrder;
    if (!sortOrder) {
      const existing = await db.collection("categories").orderBy("sortOrder", "desc").limit(1).get();
      sortOrder = existing.empty ? 1 : (existing.docs[0].data().sortOrder ?? 0) + 1;
    }

    const ref = db.collection("categories").doc();
    await ref.set({
      name: parsed.data.name,
      type: parsed.data.type,
      status: "active",
      sortOrder,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      category: {
        id: ref.id,
        name: parsed.data.name,
        type: parsed.data.type,
        status: "active",
        sortOrder,
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Create category error:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
