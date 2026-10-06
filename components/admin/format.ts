// Formatting and the Turkish words for every state the admin panel shows.

import { PACKS, isPackName } from '@/lib/packs';

const TZ = 'Europe/Istanbul';

export const num = (n: number | null | undefined, digits = 0) =>
  (n ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

// kuruş → "₺1.234" or "₺12,50"
export const tlKurus = (k: number | null | undefined) => {
  const v = (k ?? 0) / 100;
  const frac = Math.round((k ?? 0)) % 100 !== 0;
  return '₺' + v.toLocaleString('tr-TR', { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 });
};

// "6 Eki 2026 21:40"
export const dt = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ });
};

export const day = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
};

// 'YYYY-MM-DD' → "6 Eki"
export const shortDay = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00+03:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: TZ });
};

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' }) : null;
export const ago = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const s = (Date.parse(iso) - Date.now()) / 1000;
  if (Number.isNaN(s) || !rtf) return dt(iso);
  const a = Math.abs(s);
  if (a < 60) return 'az önce';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return day(iso);
};

export type Tone = 'grey' | 'blue' | 'amber' | 'green' | 'red' | 'violet';
export type Label = { label: string; tone: Tone };

export const JOB_STATUS: Record<string, Label> = {
  draft: { label: 'Taslak', tone: 'grey' },
  queued: { label: 'Sırada', tone: 'blue' },
  processing: { label: 'Okunuyor', tone: 'blue' },
  rubric: { label: 'Ölçüt bekliyor', tone: 'amber' },
  review: { label: 'Kontrolde', tone: 'amber' },
  delivering: { label: 'Gönderiliyor', tone: 'blue' },
  done: { label: 'Tamamlandı', tone: 'green' },
  failed: { label: 'Başarısız', tone: 'red' },
};
export const CLOSABLE = ['queued', 'processing', 'rubric', 'review', 'delivering'];

export const PAGE_STATUS: Record<string, Label> = {
  uploaded: { label: 'Yüklendi', tone: 'grey' },
  queued: { label: 'Sırada', tone: 'blue' },
  reading: { label: 'Okunuyor', tone: 'blue' },
  read: { label: 'Okundu', tone: 'green' },
  failed: { label: 'Okunamadı', tone: 'red' },
};

export const PAY_STATUS: Record<string, Label> = {
  paid: { label: 'Ödendi', tone: 'green' },
  pending: { label: 'Bekliyor', tone: 'amber' },
  failed: { label: 'Başarısız', tone: 'red' },
};

export const FAIL_REASON: Record<string, string> = {
  key_failed: 'Anahtar okunamadı',
  rubric_expired: 'Ölçüt onaylanmadı',
  review_expired: 'Süresi doldu',
  admin_closed: 'Yönetici kapattı',
};

export const LEDGER_REASON: Record<string, string> = {
  purchase: 'Satın alma',
  job_reserve: 'Sınav',
  job_refund: 'İade',
  admin_grant: 'Tanımlama',
  admin_debit: 'Düşme',
};

export const ACTION_LABEL: Record<string, string> = {
  'pages.grant': 'Sayfa hakkı verildi',
  'pages.debit': 'Sayfa hakkı düşüldü',
  'user.suspend': 'Askıya alındı',
  'user.unsuspend': 'Askı kaldırıldı',
  'user.role': 'Rol değişti',
  'user.verify': 'E-posta doğrulandı',
  'user.reset_mail': 'Şifre sıfırlama gönderildi',
  'job.close': 'Sınav kapatıldı',
  'payment.reconcile': 'Ödeme sorgulandı',
  'events.clear': 'Analitik temizlendi',
};

export const MODE_LABEL: Record<string, string> = { optik: 'Optik', klasik: 'Klasik' };

const LEGACY_PACK: Record<string, string> = { baslangic: 'Başlangıç', ogretmen: 'Öğretmen', zumre: 'Zümre' };
export const packLabel = (p: string | null | undefined) => {
  if (!p) return '—';
  if (isPackName(p)) return PACKS[p].name;
  return LEGACY_PACK[p] ?? p;
};

export const ROLE_LABEL: Record<string, string> = { admin: 'Yönetici', teacher: 'Öğretmen' };
const RESULT_LABEL: Record<string, string> = { paid: 'ödendi', failed: 'başarısız', unknown: 'belirsiz' };
export const reconcileLabel = (r: unknown) => RESULT_LABEL[String(r)] ?? String(r ?? '—');

// one line out of an audit row's detail
export function summarizeDetail(action: string, d: Record<string, unknown> | null | undefined): string {
  if (!d) return '';
  const parts: string[] = [];
  if (typeof d.delta === 'number') parts.push(`${d.delta > 0 ? '+' : '−'}${num(Math.abs(d.delta))} sayfa`);
  if (action === 'user.role' && d.from && d.to) parts.push(`${ROLE_LABEL[String(d.to)] ?? d.to} (önceden ${ROLE_LABEL[String(d.from)] ?? d.from})`);
  if (action === 'job.close' && typeof d.title === 'string') parts.push(`“${d.title}”`);
  if (action === 'job.close' && d.from) parts.push(`önceki durum: ${JOB_STATUS[String(d.from)]?.label ?? d.from}`);
  if (action === 'payment.reconcile' && d.result) parts.push(`sonuç: ${reconcileLabel(d.result)}`);
  if (typeof d.note === 'string' && d.note) parts.push(`Gerekçe: ${d.note}`);
  if (typeof d.email === 'string') parts.unshift(d.email);
  return parts.join('; ');
}
