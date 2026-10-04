import { Injectable, Logger } from "@nestjs/common";
import { EmailContent } from "./templates";

/**
 * Transactional email (PRD section 50). Uses Resend when RESEND_API_KEY is set.
 * Without a key (local development) the message, including its link, is printed to the
 * API terminal so the whole flow can be tested offline.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async send(to: string, content: EmailContent): Promise<void> {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      this.logger.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${content.subject}\n\n${content.text}\n`);
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Baytul Wisaal <onboarding@resend.dev>",
        to: [to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    });
    if (!res.ok) throw new Error(`Resend responded with ${res.status}`);
  }
}
