import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { DashboardService } from "@/features/dashboard/service";
import { toDecimalAmount } from "@/domain/money";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { ReportingMonth } from "@/domain/dates";

function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@\t\r\n]/.test(str)) str = "'" + str;
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7) as ReportingMonth;

  try {
    const analytics = await DashboardService.getAnalytics(user, month as ReportingMonth);
    const summary = analytics.summary;
    const baseCurrency = summary.baseCurrency;

    const lines: string[] = [];

    // Section 1: Summary
    lines.push(escapeCsvValue("Metric") + "," + escapeCsvValue(`Amount (${baseCurrency})`));
    lines.push(`Opening Fund,${escapeCsvValue(toDecimalAmount(summary.openingFundMinor, baseCurrency as any))}`);
    lines.push(`Total Revenue,${escapeCsvValue(toDecimalAmount(summary.totalRevenueMinor, baseCurrency as any))}`);
    lines.push(`Total Expenses,${escapeCsvValue(toDecimalAmount(summary.totalExpensesMinor, baseCurrency as any))}`);
    lines.push(`Net Profit,${escapeCsvValue(toDecimalAmount(summary.netProfitMinor, baseCurrency as any))}`);
    lines.push(`Closing Balance,${escapeCsvValue(toDecimalAmount(summary.closingBalanceMinor, baseCurrency as any))}`);
    
    lines.push(""); // Empty line

    // Section 2: Expense Category Breakdown
    lines.push(escapeCsvValue("Expense Category") + "," + escapeCsvValue(`Amount (${baseCurrency})`));
    for (const cat of analytics.categoryBreakdown) {
      lines.push(`${escapeCsvValue(cat.categoryId)},${escapeCsvValue(toDecimalAmount(cat.totalMinor, baseCurrency as any))}`);
    }

    lines.push(""); // Empty line

    // Section 3: Revenue Source Breakdown
    lines.push(escapeCsvValue("Revenue Source") + "," + escapeCsvValue(`Amount (${baseCurrency})`));
    for (const rev of analytics.revenueBreakdown) {
      lines.push(`${escapeCsvValue(rev.sourceId)},${escapeCsvValue(toDecimalAmount(rev.totalMinor, baseCurrency as any))}`);
    }

    const csvData = lines.join("\n");

    const db = getAdminDb();
    const batch = db.batch();
    const auditRef = db.collection("auditEvents").doc();
    batch.set(auditRef, {
      action: "report.export",
      actor: { uid: user.uid, role: "super_admin" },
      target: { collection: "ledgerEntries", id: "csv_export" },
      reason: `Exported P&L for ${month}`,
      after: {
        filterOptions: { month },
        recordCount: 1 // Representing the consolidated report
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="profit_loss_${month}.csv"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: "Failed to generate CSV export" }, { status: 500 });
  }
}
