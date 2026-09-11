import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getBills } from "@/lib/server/repositories/bills";
import { buildCsv, type CsvColumn } from "@/lib/server/csv";
import { toDecimalAmount } from "@/domain/money";
import type { BillListItem } from "@/lib/server/repositories/bills";
import { recordReportExport } from "@/lib/server/report-export";

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

    await recordReportExport({ user, collection: "bills", report: "bills", filters: { status: options.status }, recordCount: bills.length });

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
