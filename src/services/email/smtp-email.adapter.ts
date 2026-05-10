import nodemailer from 'nodemailer';
import { getEnv } from '../../config/env';
import { logger } from '../../config/logger';
import type { EmailAdapter, SendMailInput } from './email.types';

export class SmtpEmailAdapter implements EmailAdapter {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;
    const env = getEnv();
    if (!env.SMTP_HOST) {
      throw new Error('SMTP not configured');
    }
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
    return this.transporter;
  }

  async sendMail(input: SendMailInput): Promise<void> {
    const env = getEnv();
    try {
      await this.getTransporter().sendMail({
        from: env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send email');
      throw err;
    }
  }
}
