import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSalarySchema } from "../../src/features/salaries/schema";

describe("createSalarySchema", () => {
  const validPending = {
    workerName: "John Doe",
    period: "2024-05",
    amount: "50000.00",
    currency: "NGN",
    status: "pending",
    categoryId: "salary_cat",
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
  };

  const validPaid = {
    ...validPending,
    status: "paid",
    paymentDate: "2024-05-25",
  };

  it("accepts a valid pending salary", () => {
    const result = createSalarySchema.safeParse(validPending);
    assert.equal(result.success, true);
  });

  it("accepts a valid paid salary", () => {
    const result = createSalarySchema.safeParse(validPaid);
    assert.equal(result.success, true);
  });

  it("rejects paid status without paymentDate", () => {
    const result = createSalarySchema.safeParse({ ...validPaid, paymentDate: undefined });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /Payment date is required/);
    }
  });

  it("rejects pending status with paymentDate", () => {
    const result = createSalarySchema.safeParse({ ...validPending, paymentDate: "2024-05-25" });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /Payment date cannot be set/);
    }
  });

  it("rejects invalid period format", () => {
    const result = createSalarySchema.safeParse({ ...validPending, period: "2024/05" });
    assert.equal(result.success, false);
  });
});
