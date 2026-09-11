import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { getAdminDb } from "@/lib/firebase/admin";

const PAGE_SIZE = 30;

/** GET /api/audit-logs — Query audit logs with filters (Super Admin only) */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "";
    const actor = searchParams.get("actor") || "";
    const collection = searchParams.get("collection") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const cursor = searchParams.get("cursor") || "";

    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection("auditLogs").orderBy("timestamp", "desc");

    // Apply equality filters (Firestore can chain these)
    if (action) {
      query = query.where("action", "==", action);
    }
    if (actor) {
      query = query.where("actor.uid", "==", actor);
    }
    if (collection) {
      query = query.where("target.collection", "==", collection);
    }

    // Cursor pagination
    if (cursor) {
      const cursorDoc = await db.collection("auditLogs").doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    query = query.limit(PAGE_SIZE + 1);
    const snapshot = await query.get();

    const docs = snapshot.docs.slice(0, PAGE_SIZE);
    const hasMore = snapshot.docs.length > PAGE_SIZE;
    const nextCursor = hasMore ? docs[docs.length - 1].id : null;

    // Apply date filters in memory (Firestore range filters conflict with orderBy on different fields)
    let entries = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        action: data.action,
        actor: data.actor,
        target: data.target,
        before: data.before ?? null,
        after: data.after ?? null,
        reason: data.reason ?? null,
        metadata: data.metadata ?? null,
        timestamp: data.timestamp?.toDate?.()?.toISOString() ?? null,
      };
    });

    if (startDate) {
      const start = new Date(startDate + "T00:00:00Z");
      entries = entries.filter((e) => e.timestamp && new Date(e.timestamp) >= start);
    }
    if (endDate) {
      const end = new Date(endDate + "T23:59:59.999Z");
      entries = entries.filter((e) => e.timestamp && new Date(e.timestamp) <= end);
    }

    return NextResponse.json({ entries, nextCursor });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Audit log query error:", error);
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}
