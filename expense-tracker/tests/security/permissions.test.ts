import assert from "node:assert/strict";
import test from "node:test";
import { defaultSecretaryPermissions, userProfileSchema, type UserProfile } from "../../src/lib/auth/model";
import { canAccessRoute, canCorrectOperationalRecord, canCreateOperationalRecord, canViewOperationalKind, canViewOperationalRecord, canViewOperationalTotals, isSuperAdmin } from "../../src/lib/auth/permissions";

const secretary: UserProfile = {
  uid: "secretary-1", name: "Secretary", email: "secretary@example.test", role: "secretary", status: "active", permissions: { ...defaultSecretaryPermissions },
};
const admin: UserProfile = { ...secretary, uid: "admin-1", role: "super_admin" };

test("secretaries can submit but never correct any submitted record", () => {
  assert.equal(canCreateOperationalRecord(secretary), true);
  assert.equal(canCorrectOperationalRecord(secretary), false);
  assert.equal(canCorrectOperationalRecord(admin), true);
});

test("secretary expense visibility is own or explicitly assigned, never all users", () => {
  const record = { id: "expense-1", kind: "expense" as const, createdBy: secretary.uid, visibleToUserIds: [] };
  assert.equal(canViewOperationalRecord(secretary, record), true);
  assert.equal(canViewOperationalRecord(secretary, { ...record, createdBy: "another-user" }), false);
  assert.equal(canViewOperationalRecord(secretary, { ...record, createdBy: "another-user", visibleToUserIds: [secretary.uid] }), true);
  assert.equal(canViewOperationalRecord(admin, { ...record, createdBy: "another-user" }), true);
});

test("salary, transport and bill details require both type permission and record scope", () => {
  for (const [kind, permission] of [["salary", "viewSalaries"], ["transport", "viewTransport"], ["bill", "viewBills"]] as const) {
    const record = { id: `${kind}-1`, kind, createdBy: secretary.uid, visibleToUserIds: [secretary.uid] };
    assert.equal(canViewOperationalRecord(secretary, record), false);
    const allowed = { ...secretary, permissions: { ...secretary.permissions, [permission]: true } };
    assert.equal(canViewOperationalRecord(allowed, record), true);
    assert.equal(canViewOperationalRecord(allowed, { ...record, createdBy: "other", visibleToUserIds: [] }), false);
    assert.equal(canViewOperationalKind(admin, kind), true);
  }
});

test("every management route and nested record path rejects a secretary", () => {
  for (const route of ["monthly-funds", "revenue", "profit-loss", "reports", "audit-log", "users", "settings"]) {
    assert.equal(canAccessRoute(secretary, `/${route}`), false);
    assert.equal(canAccessRoute(secretary, `/${route}/sensitive-record`), false);
    assert.equal(canAccessRoute(admin, `/${route}`), true);
  }
  assert.equal(canAccessRoute(secretary, "/unknown-feature"), false);
  assert.equal(canAccessRoute(secretary, "/expenses/new"), true);
  assert.equal(canAccessRoute(secretary, "/salaries/new"), true);
  assert.equal(canAccessRoute(secretary, "/salaries"), false);
});

test("deactivation removes all privileges including administrator privileges", () => {
  for (const user of [secretary, admin]) {
    const inactive = { ...user, status: "deactivated" as const };
    assert.equal(isSuperAdmin(inactive), false);
    assert.equal(canCreateOperationalRecord(inactive), false);
    assert.equal(canCorrectOperationalRecord(inactive), false);
    assert.equal(canViewOperationalTotals(inactive), false);
    assert.equal(canAccessRoute(inactive, "/dashboard"), false);
  }
});

test("profiles reject unknown roles/status and default new permission flags to false", () => {
  assert.equal(userProfileSchema.safeParse({ ...secretary, role: "admin" }).success, false);
  assert.equal(userProfileSchema.safeParse({ ...secretary, status: "pending" }).success, false);
  assert.deepEqual(userProfileSchema.parse({ ...secretary, permissions: {} }).permissions, defaultSecretaryPermissions);
  assert.equal(userProfileSchema.safeParse({ ...secretary, permissions: undefined }).success, false);
  assert.equal(canViewOperationalTotals(secretary), false);
});
