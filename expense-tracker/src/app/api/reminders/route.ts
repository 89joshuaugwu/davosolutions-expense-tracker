import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { sendTestReminder } from "@/lib/server/reminders/service";
import { isSmtpConfigured } from "@/lib/server/reminders/mailer";
import { z } from "zod";

/** GET /api/reminders/status — Check SMTP configuration status */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({
      smtpConfigured: isSmtpConfigured(),
      cronSecretConfigured: !!process.env.CRON_SECRET,
    });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}

const testSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
});

/** POST /api/reminders/test — Send a test reminder email (Super Admin only) */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Provide a valid email and name." }, { status: 400 });
    }

    const result = await sendTestReminder(parsed.data.email, parsed.data.name);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to send test email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Test reminder sent successfully." });
  } catch (error: any) {
    if (error.name === "AuthenticationError") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to send test reminder" }, { status: 500 });
  }
}
