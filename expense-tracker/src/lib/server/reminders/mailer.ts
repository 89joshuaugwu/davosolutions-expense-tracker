import "server-only";

import nodemailer from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) return null;
  return { host, port, user, pass, from };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

function createTransport() {
  const config = getSmtpConfig();
  if (!config) throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM in environment.");

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
}

interface ReminderEmailParams {
  recipientEmail: string;
  recipientName: string;
  billName: string;
  provider: string;
  amountFormatted: string;
  dueDate: string;
  leadDays: number;
  companyName: string;
}

/**
 * Send a bill reminder email. Returns the provider message ID if available.
 * Never throws — returns null on failure so callers can persist the error.
 */
export async function sendReminderEmail(params: ReminderEmailParams): Promise<{ messageId: string | null; error: string | null }> {
  const config = getSmtpConfig();
  if (!config) return { messageId: null, error: "SMTP not configured" };

  const isOverdue = params.leadDays <= 0;
  const subject = isOverdue
    ? `⚠️ Overdue: ${params.billName} was due on ${params.dueDate}`
    : `Reminder: ${params.billName} is due in ${params.leadDays} day${params.leadDays !== 1 ? "s" : ""}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: ${isOverdue ? "#c62828" : "#1565c0"}; margin: 0 0 16px;">
        ${isOverdue ? "⚠️ Bill Overdue" : "📋 Bill Reminder"}
      </h2>
      <p>Hi ${params.recipientName},</p>
      <p>${isOverdue
        ? `The following bill was due on <strong>${params.dueDate}</strong> and is now overdue:`
        : `This is a reminder that the following bill is due in <strong>${params.leadDays} day${params.leadDays !== 1 ? "s" : ""}</strong>:`
      }</p>
      <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; color: #757575;">Bill</td><td style="padding: 4px 0; font-weight: 600;">${params.billName}</td></tr>
          <tr><td style="padding: 4px 0; color: #757575;">Provider</td><td style="padding: 4px 0;">${params.provider}</td></tr>
          <tr><td style="padding: 4px 0; color: #757575;">Amount</td><td style="padding: 4px 0; font-weight: 600;">${params.amountFormatted}</td></tr>
          <tr><td style="padding: 4px 0; color: #757575;">Due Date</td><td style="padding: 4px 0;">${params.dueDate}</td></tr>
        </table>
      </div>
      <p style="color: #757575; font-size: 13px;">
        This is an automated reminder from ${params.companyName} Expense Tracker. 
        Please log in to the system to record your payment.
      </p>
    </div>
  `;

  try {
    const transport = createTransport();
    const result = await transport.sendMail({
      from: `"${params.companyName}" <${config.from}>`,
      to: params.recipientEmail,
      subject,
      html,
    });
    return { messageId: result.messageId ?? null, error: null };
  } catch (error: any) {
    return { messageId: null, error: error.message ?? "Unknown SMTP error" };
  }
}
