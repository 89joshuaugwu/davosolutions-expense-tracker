import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertFails, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;

test("deployed rules deny all browser reads/writes, including forged admin claims", {
  skip: !firestoreHost || !storageHost ? "Requires Firestore and Storage emulators; this is not a production verification." : false,
}, async () => {
  const [firestoreHostname, firestorePort] = firestoreHost!.split(":");
  const [storageHostname, storagePort] = storageHost!.split(":");
  const environment = await initializeTestEnvironment({
    projectId: "demo-davo-expenses",
    firestore: { host: firestoreHostname, port: Number(firestorePort), rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") },
    storage: { host: storageHostname, port: Number(storagePort), rules: await readFile(new URL("../../storage.rules", import.meta.url), "utf8") },
  });
  try {
    for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext("secretary-1"), environment.authenticatedContext("admin-1", { role: "super_admin" })]) {
      for (const collection of ["users", "expenses", "salaryLogs", "transportLogs", "bills", "billPayments", "monthlyFunds", "revenue", "revenueSources", "categories", "exchangeRates", "auditLogs", "settings", "ledgerEntries"]) {
        const document = doc(context.firestore(), collection, "fixture");
        await assertFails(getDoc(document));
        await assertFails(setDoc(document, { createdBy: "secretary-1" }));
        await assertFails(deleteDoc(document));
      }
      const attachment = ref(context.storage(), "attachments/private-receipt.txt");
      await assertFails(getBytes(attachment));
      await assertFails(uploadBytes(attachment, new Uint8Array([1, 2, 3])));
      await assertFails(deleteObject(attachment));
    }
  } finally { await environment.cleanup(); }
});
