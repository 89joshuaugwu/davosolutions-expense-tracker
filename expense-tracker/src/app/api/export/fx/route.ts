import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { assertReportingMonth, currentReportingMonth } from "@/domain/dates";
import { toDecimalAmount, type CurrencyCode } from "@/domain/money";
import { getLedgerEntriesForMonth } from "@/lib/server/repositories/monthly-funds";
import { buildCsv, type CsvColumn } from "@/lib/server/csv";
import { recordReportExport } from "@/lib/server/report-export";

type FxExportRow = {
  date: string;
  direction: string;
  sourceKind: string;
  sourceId: string;
  originalAmount: string;
  currency: string;
  exchangeRate: string;
  rateDate: string;
  baseAmount: string;
  baseCurrency: string;
};

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const requestedMonth = new URL(request.url).searchParams.get("month") || currentReportingMonth();
  try { assertReportingMonth(requestedMonth); } catch { return NextResponse.json({ error: "Month must use YYYY-MM." }, { status: 400 }); }

  try {
    const postings = await getLedgerEntriesForMonth(requestedMonth);
    const rows: FxExportRow[] = postings.filter((posting) => !posting.archivedAt).map((posting) => ({
      date: posting.postedOn,
      direction: posting.direction,
      sourceKind: posting.sourceKind,
      sourceId: posting.sourceId,
      originalAmount: toDecimalAmount(posting.originalAmountMinor, posting.currency as CurrencyCode),
      currency: posting.currency,
      exchangeRate: posting.exchangeRateSnapshot,
      rateDate: posting.rateDate,
      baseAmount: toDecimalAmount(posting.baseAmountMinor, posting.baseCurrency as CurrencyCode),
      baseCurrency: posting.baseCurrency,
    }));
    const columns: CsvColumn<FxExportRow>[] = [
      { header: "Date", key: "date" }, { header: "Direction", key: "direction" },
      { header: "Source type", key: "sourceKind" }, { header: "Source ID", key: "sourceId" },
      { header: "Original amount", key: "originalAmount" }, { header: "Currency", key: "currency" },
      { header: "Applied exchange rate", key: "exchangeRate" }, { header: "Rate date", key: "rateDate" },
      { header: "Base amount", key: "baseAmount" }, { header: "Base currency", key: "baseCurrency" },
    ];
    await recordReportExport({ user, collection: "ledgerEntries", report: "currency conversion details", filters: { month: requestedMonth }, recordCount: rows.length });
    return new NextResponse(buildCsv(rows, columns), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fx_details_${requestedMonth}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("FX export error:", error);
    return NextResponse.json({ error: "Failed to generate FX CSV." }, { status: 500 });
  }
}
