import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getTransportList } from "@/lib/server/repositories/transport";
import { buildCsv, type CsvColumn } from "@/lib/server/csv";
import { toDecimalAmount } from "@/domain/money";
import type { TransportListItem } from "@/lib/server/repositories/transport";
import { recordReportExport } from "@/lib/server/report-export";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const options = {
    month: searchParams.get("month") || undefined,
    limitCount: 10000,
  };

  try {
    const items = await getTransportList(options);

    const columns: CsvColumn<TransportListItem>[] = [
      { header: "ID", key: "id" },
      { header: "Date", key: "date" },
      { header: "Morning (Minor)", key: "morningAmountMinor", format: (val, row) => toDecimalAmount(val, row.currency as any) },
      { header: "Evening (Minor)", key: "eveningAmountMinor", format: (val, row) => toDecimalAmount(val, row.currency as any) },
      { header: "Extra (Minor)", key: "extraAmountMinor", format: (val, row) => toDecimalAmount(val, row.currency as any) },
      { header: "Total Amount", key: "originalAmountMinor", format: (val, row) => toDecimalAmount(val, row.currency as any) },
      { header: "Currency", key: "currency" },
      { header: "Base Amount", key: "baseAmountMinor", format: (val, row) => toDecimalAmount(val, row.baseCurrency as any) },
      { header: "Base Currency", key: "baseCurrency" },
      { header: "Category ID", key: "categoryId" },
      { header: "Created By", key: "createdBy" },
      { header: "Archived", key: "archivedAt", format: (val) => (val ? "Yes" : "No") },
    ];

    const csvData = buildCsv(items, columns);

    await recordReportExport({ user, collection: "transportLogs", report: "transport", filters: { month: options.month }, recordCount: items.length });

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="transport_export.csv"',
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: "Failed to generate CSV export" }, { status: 500 });
  }
}
