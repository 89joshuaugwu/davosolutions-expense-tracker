import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createExpenseSchema, correctExpenseSchema, archiveExpenseSchema } from "../../src/features/expenses/schema";

describe("createExpenseSchema", () => {
  const valid = {
    title: "Office supplies",
    amount: "1500.00",
    currency: "NGN",
    categoryId: "cat-1",
    date: "2026-09-08",
    frequency: "one_time" as const,
    notes: "",
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    attachmentIds: [],
  };

  it("accepts a valid expense input", () => {
    const result = createExpenseSchema.safeParse(valid);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.title, "Office supplies");
      assert.equal(result.data.amount, "1500.00");
      assert.equal(result.data.currency, "NGN");
    }
  });

  it("rejects missing title", () => {
    const result = createExpenseSchema.safeParse({ ...valid, title: "" });
    assert.equal(result.success, false);
  });

  it("rejects title over 200 characters", () => {
    const result = createExpenseSchema.safeParse({ ...valid, title: "X".repeat(201) });
    assert.equal(result.success, false);
  });

  it("rejects negative amount", () => {
    const result = createExpenseSchema.safeParse({ ...valid, amount: "-100" });
    assert.equal(result.success, false);
  });

  it("rejects non-numeric amount", () => {
    const result = createExpenseSchema.safeParse({ ...valid, amount: "abc" });
    assert.equal(result.success, false);
  });

  it("rejects float-like scientific notation", () => {
    const result = createExpenseSchema.safeParse({ ...valid, amount: "1e5" });
    assert.equal(result.success, false);
  });

  it("rejects invalid date format", () => {
    const result = createExpenseSchema.safeParse({ ...valid, date: "09/08/2026" });
    assert.equal(result.success, false);
  });

  it("rejects empty category", () => {
    const result = createExpenseSchema.safeParse({ ...valid, categoryId: "" });
    assert.equal(result.success, false);
  });

  it("rejects invalid frequency value", () => {
    const result = createExpenseSchema.safeParse({ ...valid, frequency: "weekly" });
    assert.equal(result.success, false);
  });

  it("rejects notes over 2000 characters", () => {
    const result = createExpenseSchema.safeParse({ ...valid, notes: "X".repeat(2001) });
    assert.equal(result.success, false);
  });

  it("rejects non-UUID idempotency key", () => {
    const result = createExpenseSchema.safeParse({ ...valid, idempotencyKey: "not-a-uuid" });
    assert.equal(result.success, false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = createExpenseSchema.safeParse({ ...valid, baseAmountMinor: 150000 });
    assert.equal(result.success, false);
  });

  it("trims whitespace from title", () => {
    const result = createExpenseSchema.safeParse({ ...valid, title: "  Office supplies  " });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.title, "Office supplies");
  });

  it("defaults notes to empty string", () => {
    const withoutNotes = { ...valid } as any;
    delete withoutNotes.notes;
    const result = createExpenseSchema.safeParse(withoutNotes);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.notes, "");
  });

  it("defaults attachmentIds to empty array", () => {
    const withoutAttachments = { ...valid } as any;
    delete withoutAttachments.attachmentIds;
    const result = createExpenseSchema.safeParse(withoutAttachments);
    assert.equal(result.success, true);
    if (result.success) assert.deepEqual(result.data.attachmentIds, []);
  });

  it("accepts all valid frequency values", () => {
    for (const freq of ["one_time", "daily", "monthly", "yearly"]) {
      const result = createExpenseSchema.safeParse({ ...valid, frequency: freq });
      assert.equal(result.success, true, `${freq} should be valid`);
    }
  });

  it("accepts amount without decimals", () => {
    const result = createExpenseSchema.safeParse({ ...valid, amount: "1500" });
    assert.equal(result.success, true);
  });

  it("rejects amount with leading zeros", () => {
    const result = createExpenseSchema.safeParse({ ...valid, amount: "01500" });
    assert.equal(result.success, false);
  });
});

describe("correctExpenseSchema", () => {
  it("accepts a valid correction with reason and at least one field", () => {
    const result = correctExpenseSchema.safeParse({
      reason: "Typo in title",
      expectedRevision: 0,
      title: "Corrected title",
    });
    assert.equal(result.success, true);
  });

  it("rejects correction without any field to correct", () => {
    const result = correctExpenseSchema.safeParse({
      reason: "No actual change",
      expectedRevision: 0,
    });
    assert.equal(result.success, false);
  });

  it("rejects correction with short reason", () => {
    const result = correctExpenseSchema.safeParse({
      reason: "OK",
      expectedRevision: 0,
      title: "New title",
    });
    assert.equal(result.success, false);
  });

  it("rejects negative expectedRevision", () => {
    const result = correctExpenseSchema.safeParse({
      reason: "Fix category",
      expectedRevision: -1,
      categoryId: "cat-2",
    });
    assert.equal(result.success, false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = correctExpenseSchema.safeParse({
      reason: "Admin fix",
      expectedRevision: 0,
      title: "Fixed",
      baseAmountMinor: 999,
    });
    assert.equal(result.success, false);
  });
});

describe("archiveExpenseSchema", () => {
  it("accepts a valid archive request", () => {
    const result = archiveExpenseSchema.safeParse({
      reason: "Duplicate entry",
      expectedRevision: 2,
    });
    assert.equal(result.success, true);
  });

  it("rejects archive without reason", () => {
    const result = archiveExpenseSchema.safeParse({
      expectedRevision: 0,
    });
    assert.equal(result.success, false);
  });

  it("rejects archive with extra fields", () => {
    const result = archiveExpenseSchema.safeParse({
      reason: "Removing duplicate",
      expectedRevision: 0,
      force: true,
    });
    assert.equal(result.success, false);
  });
});
