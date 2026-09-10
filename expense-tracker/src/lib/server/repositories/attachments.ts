import "server-only";
import { getFirestore } from "firebase-admin/firestore";
import type { AttachmentReference } from "../../../domain/models";

const ATTACHMENTS_COLLECTION = "attachments";

/**
 * Persists attachment metadata. Attachments are created unassigned, and later bound
 * to expenses or other financial entries.
 */
export async function createAttachment(metadata: Omit<AttachmentReference, "uploadedAt">): Promise<AttachmentReference> {
  const db = getFirestore();
  const ref = db.collection(ATTACHMENTS_COLLECTION).doc(metadata.id);
  
  const uploadedAt = new Date().toISOString();
  const attachment: AttachmentReference = {
    ...metadata,
    uploadedAt,
  };
  
  await ref.create(attachment);
  return attachment;
}

/**
 * Retrieves attachment metadata by ID.
 */
export async function getAttachment(id: string): Promise<AttachmentReference | null> {
  const db = getFirestore();
  const snap = await db.collection(ATTACHMENTS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as AttachmentReference;
}

/**
 * Used for verifying that attachments exist and were uploaded by the correct user
 * before associating them with an expense.
 */
export async function verifyAttachmentsUpload(ids: string[], userId: string): Promise<AttachmentReference[]> {
  if (ids.length === 0) return [];
  const db = getFirestore();
  
  // Firestore `in` queries support up to 10 items.
  if (ids.length > 10) throw new Error("Too many attachments.");

  const refs = await db.collection(ATTACHMENTS_COLLECTION).where("__name__", "in", ids).get();
  
  if (refs.size !== ids.length) {
    throw new Error("One or more attachments not found.");
  }
  
  const attachments: AttachmentReference[] = [];
  refs.forEach((doc) => {
    const att = doc.data() as AttachmentReference;
    if (att.uploadedBy !== userId) {
      throw new Error(`Unauthorized attachment reuse: ${att.id}`);
    }
    attachments.push(att);
  });
  
  return attachments;
}
