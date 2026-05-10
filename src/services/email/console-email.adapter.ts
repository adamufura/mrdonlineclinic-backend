import { logger } from '../../config/logger';
import type { EmailAdapter, SendMailInput } from './email.types';

export class ConsoleEmailAdapter implements EmailAdapter {
  async sendMail(input: SendMailInput): Promise<void> {
    logger.info({ to: input.to, subject: input.subject }, 'Email (console)');
  }
}
