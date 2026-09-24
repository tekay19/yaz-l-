import nodemailer from 'nodemailer';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer }[];
};
export type Mailer = { send(msg: MailMessage): Promise<void> };

let cached: Mailer | null = null;

// SMTP_URL example: smtps://user:pass@smtp.example.com:465
export function getMailer(): Mailer {
  if (cached) return cached;
  const url = process.env.SMTP_URL;
  const from = process.env.MAIL_FROM;
  if (!url || !from) throw new Error('SMTP_URL and MAIL_FROM must be set');
  const transport = nodemailer.createTransport(url);
  cached = { send: async (msg) => { await transport.sendMail({ from, ...msg }); } };
  return cached;
}
