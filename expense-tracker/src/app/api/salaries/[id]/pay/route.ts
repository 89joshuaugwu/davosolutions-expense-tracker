import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth/session";
import { canCorrectOperationalRecord } from "../../../../../lib/auth/permissions";
import { paySalary, SalaryServiceError } from "../../../../../features/salaries/service";
import { paySalarySchema } from "../../../../../features/salaries/schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Active session required." }, { status: 401 });
    }

    if (!canCorrectOperationalRecord(user)) {
      return NextResponse.json({ error: "Only a Super Admin can mark a submitted salary as paid." }, { status: 403 });
    }

    const json = await request.json();
    const parsed = paySalarySchema.safeParse(json);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
    }

    await paySalary(id, parsed.data);
    return NextResponse.json({ success: true });

  } catch (error) {
    if (error instanceof SalaryServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
