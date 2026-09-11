import { NextResponse } from "next/server";
import { processReminders } from "@/lib/server/reminders/service";

/**
 * POST /api/cron/reminders
 * 
 * Authenticated cron endpoint for processing bill reminders.
 * Vercel Cron or an external scheduler calls this daily.
 * 
 * Authentication: Bearer token matching CRON_SECRET env var.
 * Rejects unauthenticated requests to prevent manual abuse.
 */
export async function POST(request: Request) {
  // Authenticate with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await processReminders();
    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error: any) {
    console.error("Reminder cron error:", error);
    return NextResponse.json({
      ok: false,
      error: error.message || "Internal error during reminder processing",
    }, { status: 500 });
  }
}

/** GET for Vercel Cron compatibility (some schedulers use GET) */
export async function GET(request: Request) {
  return POST(request);
}
