import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Mail adapter. Development: logs the message. Set SMTP_URL to plug in a
 * provider (e.g. Resend, Postmark, SES) by replacing this function body.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (process.env.NODE_ENV !== "production" || !process.env.SMTP_URL) {
    console.info(`[mail:mock] to=${message.to} subject="${message.subject}"`);
    return;
  }
  // Provider integration point
}
