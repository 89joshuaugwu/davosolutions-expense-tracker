import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { listUsers, createUser } from "@/lib/server/repositories/users";
import { roleSchema, operationalPermissionsSchema, defaultSecretaryPermissions } from "@/lib/auth/model";
import { z } from "zod";

/** GET /api/users — List all users (Super Admin only) */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

const createUserSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  name: z.string().trim().min(1, "Name is required.").max(120),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  role: roleSchema,
  permissions: operationalPermissionsSchema.optional(),
});

/** POST /api/users — Create/invite a new user (Super Admin only) */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { email, name, password, role, permissions } = parsed.data;

    const newUser = await createUser({
      email,
      name,
      password,
      role,
      permissions: permissions ?? defaultSecretaryPermissions,
      createdByUid: user.uid,
      createdByRole: user.role,
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (error.message?.includes("already exists")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Create user error:", error);
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
  }
}
