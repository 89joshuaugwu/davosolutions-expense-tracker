import "server-only";

import type { UserProfile } from "@/lib/auth/model";
import { appendAudit } from "@/lib/server/audit";

type ExportFilterValue = string | number | boolean | null | undefined;

function cleanFilters(filters: Record<string, ExportFilterValue>): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean | null>;
}

/** Records the fact and scope of a successful export without storing its contents. */
export async function recordReportExport(input: {
  user: UserProfile;
  collection: string;
  report: string;
  filters: Record<string, ExportFilterValue>;
  recordCount: number;
}): Promise<void> {
  await appendAudit({
    action: "report.export",
    actor: { uid: input.user.uid, role: input.user.role },
    target: { collection: input.collection, id: "csv_export" },
    reason: `Exported ${input.report} to CSV`,
    after: {
      filters: cleanFilters(input.filters),
      recordCount: input.recordCount,
    },
  });
}
