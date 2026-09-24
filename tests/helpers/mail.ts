import type { Mailer, MailMessage } from '@/lib/mail';

export function fakeMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return { sent, send: async (m) => { sent.push(m); } };
}
