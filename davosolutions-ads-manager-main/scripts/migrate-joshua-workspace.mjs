/* One-time, dry-run-first move from the legacy Firebase project to the company project.
 * Run `node scripts/migrate-joshua-workspace.mjs` first. Add `--apply` only after reviewing counts. */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const EMAIL = "joshuaugwu89@gmail.com";
const DESTINATION_UID = "7Thx93TAQgex75FL4poDESNXeDO2";
const APPLY = process.argv.includes("--apply");
const root = process.cwd();
const credential = (file) => cert(JSON.parse(readFileSync(file, "utf8")));
const source = getFirestore(initializeApp({ credential: credential(resolve(root, "../davopay-ads-manager/davoadsmanager-firebase-adminsdk.json")) }, "legacy-source"));
const destination = getFirestore(initializeApp({ credential: credential(resolve(root, "davoadsmanager-firebase-adminsdk.json")) }, "company-destination"));
const collections = ["gmailAccounts", "businessAccounts", "adsAccounts", "dailyEntries", "cards", "transactions", "dailyRevenue", "auditLogs"];

async function sourceProfile() {
  const result = await source.collection("users").where("email", "==", EMAIL).limit(1).get();
  if (result.empty || !result.docs[0].data().workspaceId) throw new Error(`Legacy profile/workspace not found for ${EMAIL}.`);
  return { uid: result.docs[0].id, workspaceId: result.docs[0].data().workspaceId };
}

async function destinationProfile() {
  const result = await destination.collection("users").doc(DESTINATION_UID).get(); const user = result.data();
  if (!result.exists || String(user?.email || "").toLowerCase() !== EMAIL || !user?.workspaceId || user.role !== "member") throw new Error("Destination UID must be the active Joshua member profile with a workspace.");
  if (!(await destination.collection("workspaces").doc(user.workspaceId).get()).exists) throw new Error("Destination Joshua workspace document is missing.");
  return { workspaceId: user.workspaceId };
}

async function main() {
  const [oldUser, newUser] = await Promise.all([sourceProfile(), destinationProfile()]);
  const grouped = new Map();
  for (const name of collections) grouped.set(name, (await source.collection(name).where("workspaceId", "==", oldUser.workspaceId).get()).docs);
  const counts = Object.fromEntries([...grouped.entries()].map(([name, docs]) => [name, docs.length]));
  console.table({ email: EMAIL, sourceUserUid: oldUser.uid, sourceWorkspace: oldUser.workspaceId, destinationUserUid: DESTINATION_UID, destinationWorkspace: newUser.workspaceId, mode: APPLY ? "APPLY — WRITES ENABLED" : "DRY RUN — NO WRITES" });
  console.table(counts);
  if (!APPLY) return console.log("Dry run only. When these counts look right, run this same command with --apply.");

  let batch = destination.batch(); let inBatch = 0; let copied = 0;
  for (const [name, docs] of grouped) for (const item of docs) {
    batch.set(destination.collection(name).doc(item.id), { ...item.data(), workspaceId: newUser.workspaceId, ownerId: DESTINATION_UID });
    copied += 1; inBatch += 1;
    if (inBatch === 450) { await batch.commit(); batch = destination.batch(); inBatch = 0; }
  }
  if (inBatch) await batch.commit();
  await destination.collection("auditLogs").add({ workspaceId: newUser.workspaceId, actorId: DESTINATION_UID, actorEmail: EMAIL, action: "workspace_migrated", entityType: "workspace", entityId: newUser.workspaceId, entityLabel: "Legacy Joshua workspace transfer", details: { sourceWorkspaceId: oldUser.workspaceId, copied, counts }, createdAt: Date.now() });
  console.log(`Migration complete: ${copied} records copied into Joshua's company workspace.`);
}
main().catch((error) => { console.error("Migration stopped:", error.message); process.exitCode = 1; });
