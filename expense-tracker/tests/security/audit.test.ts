import assert from "node:assert/strict";
import test from "node:test";
import { auditEventSchema } from "../../src/lib/server/audit-model";

const base = { action: "record.create", actor: { uid: "user-1", role: "secretary" }, target: { collection: "expenses", id: "expense-1" }, after: { baseAmountMinor: 30000 } };

test("corrections require a reason and before/after values", () => {
  assert.equal(auditEventSchema.safeParse(base).success, true);
  const correction = { ...base, action: "record.correct" };
  assert.equal(auditEventSchema.safeParse(correction).success, false);
  assert.equal(auditEventSchema.safeParse({ ...correction, reason: "Receipt amount corrected", before: { baseAmountMinor: 20000 } }).success, true);
  assert.equal(auditEventSchema.safeParse({ ...correction, reason: "  ", before: {} }).success, false);
});

test("sensitive credential fields and unsupported snapshot values cannot enter audit logs", () => {
  for (const value of [{ password: "secret" }, { nested: { idToken: "token" } }, { rows: [{ refreshToken: "token" }] }, { amount: Number.NaN }, { amount: 1n }, { date: new Date() }]) {
    assert.equal(auditEventSchema.safeParse({ ...base, after: value }).success, false);
  }
});

test("role changes require reasons and audit events cannot accept arbitrary fields", () => {
  assert.equal(auditEventSchema.safeParse({ ...base, action: "user.role_change" }).success, false);
  assert.equal(auditEventSchema.safeParse({ ...base, action: "auth.login", token: "secret" }).success, false);
  assert.equal(auditEventSchema.safeParse({ ...base, target: { collection: "users", id: "../other" } }).success, false);
});
