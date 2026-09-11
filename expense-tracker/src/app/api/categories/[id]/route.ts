import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(["general", "salary", "transport", "bill", "other"]).optional(),
  sortOrder: z.number().int().min(1).max(999).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

/** PATCH /api/categories/[id] — Update or archive a category (Super Admin only) */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const ref = db.collection("categories").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const updateData: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
    if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

    await ref.update(updateData);

    const updated = { ...snapshot.data(), ...updateData, id };
    return NextResponse.json({ category: updated });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Update category error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}
