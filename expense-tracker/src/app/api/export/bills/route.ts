import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getBills } from "@/lib/server/repositories/bills";
import { buildCsv, type CsvColumn } from "@/lib/server/csv";
import { toDecimalAmount } from "@/domain/money";
import { getAdminDb } from "@/lib/firebase/admin";
import type { BillListItem } from "@/lib/server/repositories/bills";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const options = {
    status: (searchParams.get("status") as any) || undefined,
  };

  try {
    const bills = await getBills(options);

    const columns: CsvColumn<BillListItem>[] = [
      { header: "ID", key: "id" },
      { header: "Name", key: "name" },
      { header: "Provider", key: "provider" },
      { header: "Frequency", key: "frequency" },
      { header: "Status", key: "status" },
      { header: "Next Due Date", key: "nextDueDate" },
      { header: "Amount", key: "amountMinor", format: (val, row) => toDecimalAmount(val, row.currency as any) },
      { header: "Currency", key: "currency" },
      { header: "Category ID", key: "categoryId" },
      { header: "Created By", key: "createdBy" },
    ];

    const csvData = buildCsv(bills, columns);

    const db = getAdminDb();
    const batch = db.batch();
    const auditRef = db.collection("auditEvents").doc();
    batch.set(auditRef, {
      action: "report.export",
      actor: { uid: user.uid, role: "super_admin" },
      target: { collection: "bills", id: "csv_export" },
      reason: "Exported bills to CSV",
      after: {
        filterOptions: options,
        recordCount: bills.length
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bills_export.csv"',
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: "Failed to generate CSV export" }, { status: 500 });
  }
}
