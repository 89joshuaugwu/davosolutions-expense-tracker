import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getUserById, updateUser } from "@/lib/server/repositories/users";
import { roleSchema, userStatusSchema, operationalPermissionsSchema } from "@/lib/auth/model";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/users/[id] — Get user detail (Super Admin only) */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const target = await getUserById(id);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: target });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.optional(),
  status: userStatusSchema.optional(),
  permissions: operationalPermissionsSchema.optional(),
  reason: z.string().trim().min(3, "Reason must be at least 3 characters.").max(1000),
});

/** PATCH /api/users/[id] — Update user role, status, or permissions (Super Admin only) */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { reason, ...updates } = parsed.data;

    const updatedUser = await updateUser(
      id,
      updates,
      { uid: user.uid, role: user.role },
      reason,
    );

    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (error.message?.includes("last active Super Admin")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.message === "User not found.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Update user error:", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}
