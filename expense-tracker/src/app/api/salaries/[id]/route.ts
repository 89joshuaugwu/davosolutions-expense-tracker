import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth/session";
import { canViewOperationalKind, canCorrectOperationalRecord } from "../../../../lib/auth/permissions";
import { getAdminDb } from "../../../../lib/firebase/admin";
import { getSalaryInTransaction } from "../../../../lib/server/repositories/salaries";
import { correctSalary, archiveSalary, SalaryServiceError } from "../../../../features/salaries/service";
import { correctSalarySchema, archiveSalarySchema } from "../../../../features/salaries/schema";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Active session required." }, { status: 401 });
    }

    if (!canViewOperationalKind(user, "salary")) {
      return NextResponse.json({ error: "You do not have permission to view salaries." }, { status: 403 });
    }

    const db = getAdminDb();
    const salary = await db.runTransaction(async (t) => {
      return getSalaryInTransaction(t, id);
    });

    if (!salary || salary.archivedAt) {
      return NextResponse.json({ error: "Salary not found." }, { status: 404 });
    }

    // Role-based filtering if secretary. In v1 we rely on visibleToUserIds or createdBy
    if (user.role === "secretary") {
      if (salary.createdBy !== user.uid && !salary.visibleToUserIds.includes(user.uid)) {
        return NextResponse.json({ error: "Salary not found." }, { status: 404 });
      }
    }

    return NextResponse.json(salary);
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Active session required." }, { status: 401 });
    }

    if (!canCorrectOperationalRecord(user)) {
      return NextResponse.json({ error: "Only a Super Admin can correct or archive a submitted record." }, { status: 403 });
    }

    const json = await request.json();

    if (json.action === "archive") {
      const parsed = archiveSalarySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
      }
      await archiveSalary(id, parsed.data);
      return NextResponse.json({ success: true });
    } else {
      const parsed = correctSalarySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
      }
      await correctSalary(id, parsed.data);
      return NextResponse.json({ success: true });
    }
  } catch (error: unknown) {
    if (error instanceof SalaryServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
