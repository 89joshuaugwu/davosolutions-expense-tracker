import { z } from "zod";
import { roleSchema } from "../auth/model";

export const auditActionSchema = z.enum([
  "auth.login", "auth.logout", "auth.login_denied", "user.bootstrap", "user.invite", "user.update", "user.role_change",
  "record.create", "record.correct", "record.archive", "record.recalculate", "fund.create", "fund.update",
  "rate.create", "rate.update", "settings.update", "bill.payment", "bill.reminder", "report.export",
]);

const sensitiveKey = /^(password|passwordHash|idToken|sessionCookie|accessToken|refreshToken|authorization|privateKey|secret|cookie)$/i;
function isSafeAuditData(value: unknown, depth = 0): boolean {
  if (depth > 20) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((child) => isSafeAuditData(child, depth + 1));
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).every(([key, child]) => !sensitiveKey.test(key) && isSafeAuditData(child, depth + 1));
}

const snapshotSchema = z.record(z.string(), z.unknown()).refine((value) => isSafeAuditData(value), "Audit snapshots must be plain JSON without credential fields.");
const reasonActions = new Set(["record.correct", "record.archive", "record.recalculate", "user.update", "user.role_change", "fund.update", "rate.update", "settings.update"]);

export const auditEventSchema = z.object({
  action: auditActionSchema,
  actor: z.object({ uid: z.string().min(1).max(128), role: z.union([roleSchema, z.literal("system"), z.null()]) }),
  target: z.object({ collection: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/), id: z.string().min(1).max(128).refine((value) => !value.includes("/")) }),
  before: snapshotSchema.optional(),
  after: snapshotSchema.optional(),
  reason: z.string().trim().min(3).max(1000).optional(),
  metadata: z.object({ requestId: z.uuid().optional(), ipHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).optional(),
}).strict().superRefine((event, context) => {
  if (reasonActions.has(event.action) && !event.reason) context.addIssue({ code: "custom", path: ["reason"], message: "An audit reason is required for this change." });
  if (event.action.startsWith("record.") && event.action !== "record.create" && (!event.before || !event.after)) {
    context.addIssue({ code: "custom", message: "Corrections and archives require before and after snapshots." });
  }
  try {
    if (JSON.stringify(event).length > 150_000) context.addIssue({ code: "custom", message: "Audit event is too large." });
  } catch { context.addIssue({ code: "custom", message: "Audit event must be serializable JSON." }); }
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
