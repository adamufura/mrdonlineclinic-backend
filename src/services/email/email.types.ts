export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailAdapter {
  sendMail(input: SendMailInput): Promise<void>;
}
