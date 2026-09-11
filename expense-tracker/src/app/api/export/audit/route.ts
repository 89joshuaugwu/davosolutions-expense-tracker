import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { assertReportingMonth } from "@/domain/dates";
import { getAdminDb } from "@/lib/firebase/admin";
import { buildCsv, type CsvColumn } from "@/lib/server/csv";
import { recordReportExport } from "@/lib/server/report-export";

const MAX_ROWS = 5_000;

type AuditExportRow = {
  timestamp: string;
  action: string;
  actorUid: string;
  actorRole: string;
  collection: string;
  targetId: string;
  reason: string;
};

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const month = new URL(request.url).searchParams.get("month") || undefined;
  if (month) {
    try { assertReportingMonth(month); } catch { return NextResponse.json({ error: "Month must use YYYY-MM." }, { status: 400 }); }
  }

  try {
    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection("auditLogs").orderBy("timestamp", "desc");
    if (month) {
      const [year, monthNumber] = month.split("-").map(Number);
      const start = new Date(Date.UTC(year!, monthNumber! - 1, 1));
      const end = new Date(Date.UTC(year!, monthNumber!, 1));
      query = query.where("timestamp", ">=", start).where("timestamp", "<", end);
    }
    const snapshot = await query.limit(MAX_ROWS + 1).get();
    if (snapshot.size > MAX_ROWS) {
      return NextResponse.json({ error: "This audit export has more than 5,000 rows. Select a narrower month." }, { status: 413 });
    }

    const rows: AuditExportRow[] = snapshot.docs.map((doc) => {
      const value = doc.data();
      return {
        timestamp: value.timestamp?.toDate?.()?.toISOString() ?? "",
        action: String(value.action ?? ""),
        actorUid: String(value.actor?.uid ?? ""),
        actorRole: String(value.actor?.role ?? ""),
        collection: String(value.target?.collection ?? ""),
        targetId: String(value.target?.id ?? ""),
        reason: String(value.reason ?? ""),
      };
    });
    const columns: CsvColumn<AuditExportRow>[] = [
      { header: "Timestamp", key: "timestamp" }, { header: "Action", key: "action" },
      { header: "Actor UID", key: "actorUid" }, { header: "Actor Role", key: "actorRole" },
      { header: "Target Collection", key: "collection" }, { header: "Target ID", key: "targetId" },
      { header: "Reason", key: "reason" },
    ];
    await recordReportExport({ user, collection: "auditLogs", report: "audit trail", filters: { month }, recordCount: rows.length });
    return new NextResponse(buildCsv(rows, columns), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit_trail${month ? `_${month}` : ""}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Audit export error:", error);
    return NextResponse.json({ error: "Failed to generate audit CSV." }, { status: 500 });
  }
}
