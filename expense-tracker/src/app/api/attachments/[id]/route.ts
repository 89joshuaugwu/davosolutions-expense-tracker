import { getSessionUser } from "../../../../lib/auth/session";
import { getAttachment } from "../../../../lib/server/repositories/attachments";
import { getProxiedAttachmentStream } from "../../../../lib/cloudinary/server";
import { getAdminDb } from "../../../../lib/firebase/admin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return new Response("Unauthorized", { status: 401 });
    }

    const attachment = await getAttachment(id);
    if (!attachment) {
      return new Response("Attachment not found", { status: 404 });
    }

    // Security check:
    // 1. Uploader can view
    // 2. Super admin can view
    // 3. Otherwise, we must check if the attachment is bound to a record the user can see.
    let authorized = user.uid === attachment.uploadedBy || user.role === "super_admin";

    // Internal extended fields added during record creation
    const stored = attachment as Record<string, unknown>;
    
    if (!authorized && stored.associatedRecordId && stored.associatedRecordKind) {
      const db = getAdminDb();
      let collectionName = "";
      if (stored.associatedRecordKind === "expense") collectionName = "expenses";
      else if (stored.associatedRecordKind === "salary") collectionName = "salaries";
      else if (stored.associatedRecordKind === "transport") collectionName = "transportLogs";
      else if (stored.associatedRecordKind === "billPayment") collectionName = "billPayments";
      else if (stored.associatedRecordKind === "revenue") collectionName = "revenues";

      if (collectionName) {
        const recordSnap = await db.collection(collectionName).doc(stored.associatedRecordId).get();
        if (recordSnap.exists) {
          const record = recordSnap.data() as Record<string, unknown>;
          
          if (record.createdBy === user.uid) {
            authorized = true;
          } else if (Array.isArray(record.visibleToUserIds) && record.visibleToUserIds.includes(user.uid)) {
            // User is explicitly assigned
            // But they also need role permission to view the kind.
            if (stored.associatedRecordKind === "salary" && user.permissions?.viewSalaries) authorized = true;
            else if (stored.associatedRecordKind === "transport" && user.permissions?.viewTransport) authorized = true;
            else if (stored.associatedRecordKind === "billPayment" && user.permissions?.viewBills) authorized = true;
            else if (stored.associatedRecordKind === "expense") authorized = true;
          }
        }
      }
    }

    if (!authorized) {
      return new Response("Forbidden", { status: 403 });
    }

    const proxy = await getProxiedAttachmentStream(attachment.storageKey, attachment.contentType === "image" ? "image" : "raw", "1");
    
    if (!proxy) {
      return new Response("Upstream attachment not found", { status: 404 });
    }

    return new Response(proxy.stream as BodyInit, {
      headers: {
        "Content-Type": proxy.contentType,
        "Content-Length": proxy.contentLength || "",
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        // Do not cache sensitive documents in intermediate proxies
        "Cache-Control": "private, max-age=3600",
      }
    });
  } catch (error) {
    console.error("Attachment proxy error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
