import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { listExpenses } from "@/lib/server/repositories/expenses";
import { buildCsv, type CsvColumn } from "@/lib/server/csv";
import { toDecimalAmount } from "@/domain/money";
import { appendAudit } from "@/lib/server/audit";
import { getAdminDb } from "@/lib/firebase/admin";
import type { ExpenseListItem } from "@/lib/server/repositories/expenses";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const options = {
    uid: user.uid,
    isSuperAdmin: true,
    month: searchParams.get("month") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    currency: searchParams.get("currency") || undefined,
    frequency: searchParams.get("frequency") || undefined,
    createdBy: searchParams.get("createdBy") || undefined,
    pageSize: 10000, // Large enough to grab all relevant data for most standard queries
  };

  try {
    const { items } = await listExpenses(options);

    const columns: CsvColumn<ExpenseListItem>[] = [
      { header: "ID", key: "id" },
      { header: "Date", key: "date" },
      { header: "Title", key: "title" },
      { header: "Category ID", key: "categoryId" },
      { header: "Frequency", key: "frequency" },
      { header: "Amount", key: "originalAmountMinor", format: (val, row) => toDecimalAmount(val, row.currency as any) },
      { header: "Currency", key: "currency" },
      { header: "Base Amount", key: "baseAmountMinor", format: (val, row) => toDecimalAmount(val, row.baseCurrency as any) },
      { header: "Base Currency", key: "baseCurrency" },
      { header: "Created By", key: "createdBy" },
      { header: "Archived", key: "archivedAt", format: (val) => (val ? "Yes" : "No") },
    ];

    const csvData = buildCsv(items, columns);

    // Audit Log
    const db = getAdminDb();
    const batch = db.batch();
    const auditRef = db.collection("auditEvents").doc();
    batch.set(auditRef, {
      action: "report.export",
      actor: { uid: user.uid, role: "super_admin" },
      target: { collection: "expenses", id: "csv_export" },
      reason: "Exported expenses to CSV",
      after: {
        filterOptions: options,
        recordCount: items.length
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="expenses_export.csv"',
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: "Failed to generate CSV export" }, { status: 500 });
  }
}
