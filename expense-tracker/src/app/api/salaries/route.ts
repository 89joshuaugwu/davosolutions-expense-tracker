import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth/session";
import { canViewOperationalKind, canCreateOperationalRecord } from "../../../lib/auth/permissions";
import { createSalary, SalaryServiceError } from "../../../features/salaries/service";
import { getSalaries } from "../../../lib/server/repositories/salaries";
import { createSalarySchema } from "../../../features/salaries/schema";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Active session required." }, { status: 401 });
    }

    if (!canViewOperationalKind(user, "salary")) {
      return NextResponse.json({ error: "You do not have permission to view salaries." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const startAfter = searchParams.get("startAfter") || undefined;
    const period = searchParams.get("period") || undefined;
    const status = searchParams.get("status") as "pending" | "paid" | undefined;
    const workerName = searchParams.get("workerName") || undefined;

    // Use allowedUserIds for filtering assignments/own if secretary
    // For now, if role is secretary, they can only view records created by them or visible to them
    let allowedUserIds: string[] | null = null; // null means all
    if (user.role === "secretary") {
      // In a real app, this should include assignments
      allowedUserIds = [user.uid];
    }

    const { salaries, nextCursor } = await getSalaries(allowedUserIds, {
      limit,
      startAfter,
      period,
      status,
      workerName,
    });

    return NextResponse.json({ salaries, nextCursor });
  } catch (error: unknown) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Active session required." }, { status: 401 });
    }

    if (!canCreateOperationalRecord(user)) {
      return NextResponse.json({ error: "You do not have permission to log salaries." }, { status: 403 });
    }

    const json = await request.json();
    const parsed = createSalarySchema.safeParse(json);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
    }

    const result = await createSalary(parsed.data);
    return NextResponse.json(result, { status: 201 });

  } catch (error: unknown) {
    if (error instanceof SalaryServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
