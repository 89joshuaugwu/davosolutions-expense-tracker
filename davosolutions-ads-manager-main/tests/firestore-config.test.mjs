import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Firestore indexes cover workspace-scoped spend and transaction reports", async () => {
  const indexes = JSON.parse(await readFile(new URL("../firestore.indexes.json", import.meta.url), "utf8")).indexes;
  const signature = (index) => `${index.collectionGroup}:${index.fields.map((field) => `${field.fieldPath}:${field.order}`).join(",")}`;
  const available = new Set(indexes.map(signature));
  assert.ok(available.has("dailyEntries:workspaceId:ASCENDING,date:ASCENDING"));
  assert.ok(available.has("transactions:workspaceId:ASCENDING,date:DESCENDING"));
});

test("revenue stays restricted to super administrators", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /match \/dailyRevenue\/\{docId\}[\s\S]*allow read, create, update, delete: if isSuperAdmin\(\)/);
});
