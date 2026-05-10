import { getEnv } from '../../config/env';
import { ConsoleEmailAdapter } from './console-email.adapter';
import { SmtpEmailAdapter } from './smtp-email.adapter';
import type { EmailAdapter } from './email.types';

let adapter: EmailAdapter | null = null;

export function getEmailAdapter(): EmailAdapter {
  if (adapter) return adapter;
  const env = getEnv();
  adapter = env.SMTP_HOST ? new SmtpEmailAdapter() : new ConsoleEmailAdapter();
  return adapter;
}
