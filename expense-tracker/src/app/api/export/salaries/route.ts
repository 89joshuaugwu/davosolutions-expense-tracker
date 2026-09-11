import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getSalaries } from "@/lib/server/repositories/salaries";
import { buildCsv, type CsvColumn } from "@/lib/server/csv";
import { toDecimalAmount } from "@/domain/money";
import { getAdminDb } from "@/lib/firebase/admin";
import type { SalaryDetail } from "@/lib/server/repositories/salaries";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filters = {
    period: searchParams.get("period") || undefined,
    workerName: searchParams.get("workerName") || undefined,
    status: (searchParams.get("status") as any) || undefined,
    limit: 10000,
  };

  try {
    const { salaries } = await getSalaries(null, filters);

    const columns: CsvColumn<SalaryDetail>[] = [
      { header: "ID", key: "id" },
      { header: "Worker Name", key: "workerName" },
      { header: "Worker Reference", key: "workerRef" },
      { header: "Period", key: "period" },
      { header: "Status", key: "status" },
      { header: "Payment Date", key: "paymentDate" },
      { header: "Amount", key: "originalAmountMinor", format: (val, row) => toDecimalAmount(val, row.currency as any) },
      { header: "Currency", key: "currency" },
      { header: "Base Amount", key: "baseAmountMinor", format: (val, row) => toDecimalAmount(val, row.baseCurrency as any) },
      { header: "Base Currency", key: "baseCurrency" },
      { header: "Category ID", key: "categoryId" },
      { header: "Created By", key: "createdBy" },
      { header: "Archived", key: "archivedAt", format: (val) => (val ? "Yes" : "No") },
    ];

    const csvData = buildCsv(salaries, columns);

    const db = getAdminDb();
    const batch = db.batch();
    const auditRef = db.collection("auditEvents").doc();
    batch.set(auditRef, {
      action: "report.export",
      actor: { uid: user.uid, role: "super_admin" },
      target: { collection: "salaries", id: "csv_export" },
      reason: "Exported salaries to CSV",
      after: {
        filterOptions: filters,
        recordCount: salaries.length
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="salaries_export.csv"',
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: "Failed to generate CSV export" }, { status: 500 });
  }
}
