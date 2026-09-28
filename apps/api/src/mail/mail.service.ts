import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { ENV, type Env } from '../config/env';

export type Mail = { to: string; subject: string; text: string };

/** Sends transactional email over SMTP (Mailpit locally, Amazon SES or Resend in production). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
    });
  }

  async send(mail: Mail): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.env.MAIL_FROM, ...mail });
    } catch (err) {
      // Email failure must not break the request; the queue-based sender (phase 2) will retry.
      this.logger.error({ err, subject: mail.subject }, 'Email send failed');
    }
  }
}
