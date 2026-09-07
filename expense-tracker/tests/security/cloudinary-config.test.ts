import assert from "node:assert/strict";
import test from "node:test";
import { cloudinaryConfigSchema } from "../../src/lib/cloudinary/config";

const fixture = { ATTACHMENT_PROVIDER: "cloudinary", CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_UPLOAD_PRESET: "test-signed-preset", CLOUDINARY_API_KEY: "123456789", CLOUDINARY_API_SECRET: "fictional-test-secret" };

test("Cloudinary configuration requires every server-side credential and selected provider", () => {
  assert.equal(cloudinaryConfigSchema.safeParse(fixture).success, true);
  for (const key of Object.keys(fixture)) assert.equal(cloudinaryConfigSchema.safeParse({ ...fixture, [key]: "" }).success, false);
  assert.equal(cloudinaryConfigSchema.safeParse({ ...fixture, ATTACHMENT_PROVIDER: "firebase_storage" }).success, false);
});

test("Cloudinary configuration rejects injected cloud paths and malformed credentials", () => {
  for (const cloud of ["https://example.com", "../another-cloud", "test?next=bad", "test/cloud"]) assert.equal(cloudinaryConfigSchema.safeParse({ ...fixture, CLOUDINARY_CLOUD_NAME: cloud }).success, false);
  assert.equal(cloudinaryConfigSchema.safeParse({ ...fixture, CLOUDINARY_API_KEY: "not-a-key" }).success, false);
  assert.equal(cloudinaryConfigSchema.safeParse({ ...fixture, CLOUDINARY_API_SECRET: "  secret  " }).success, false);
});
