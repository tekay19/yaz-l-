'use client';

import Link from 'next/link';
import type { JobView } from '@/components/console/api';

// The building blocks every screen of the panel is made of.

export function PageHeader({ title, sub, actions, back }: {
  title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string };
}) {
  return (
    <div className="app-head">
      {back && <Link href={back.href} className="app-back">← {back.label}</Link>}
      <div className="app-head-row">
        <div>
          <h1>{title}</h1>
          {sub && <p className="app-sub">{sub}</p>}
        </div>
        {actions && <div className="app-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'warn' | 'good' }) {
  return (
    <div className={`app-stat${tone ? ` ${tone}` : ''}`}>
      <span className="k">{label}</span>
      <span className="v">{value}</span>
      {hint && <span className="h">{hint}</span>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="app-empty">
      {icon && <div className="app-empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { id: T; label: string; badge?: number | string | null }[]; value: T; onChange: (id: T) => void;
}) {
  return (
    <div className="app-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : undefined} onClick={() => onChange(t.id)}>
          {t.label}
          {t.badge ? <span className="app-tab-badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ---- an exam's state, the same words everywhere ----------------------------

export type Tone = 'grey' | 'blue' | 'amber' | 'green' | 'red';
type Meta = { label: string; tone: Tone; action?: string; tab?: string };

export const EXAM_STATUS: Record<string, Meta> = {
  draft: { label: 'Taslak', tone: 'grey', action: 'Yüklemeye devam edin' },
  queued: { label: 'Sırada', tone: 'blue' },
  processing: { label: 'Okunuyor', tone: 'blue' },
  rubric: { label: 'Ölçüt onayınızı bekliyor', tone: 'amber', action: 'Ölçütleri onaylayın', tab: 'olcutler' },
  review: { label: 'Kontrolünüzü bekliyor', tone: 'amber', action: 'Kâğıtları kontrol edin', tab: 'kontrol' },
  delivering: { label: 'Rapor hazırlanıyor', tone: 'blue' },
  done: { label: 'Tamamlandı', tone: 'green', action: 'Sonuçları görün', tab: 'sonuclar' },
  failed: { label: 'Anahtar okunamadı', tone: 'red' },
};
export const statusOf = (s: string, rubricApproved = false): Meta =>
  (s === 'processing' && rubricApproved ? { label: 'Puanlanıyor', tone: 'blue' } : EXAM_STATUS[s] ?? { label: s, tone: 'grey' });
export const needsTeacher = (j: Pick<JobView, 'status'>) => j.status === 'rubric' || j.status === 'review' || j.status === 'draft';
export const isActive = (j: Pick<JobView, 'status'>) => ['queued', 'processing', 'delivering'].includes(j.status);

// where an exam's next step happens: the wizard for a draft, its own tab otherwise
export function examHref(j: Pick<JobView, 'id' | 'status'>) {
  if (j.status === 'draft') return `/yukle?sinav=${j.id}`;
  const tab = statusOf(j.status).tab;
  return `/hesap/sinav/${j.id}${tab ? `?sekme=${tab}` : ''}`;
}

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`app-badge ${tone}`}>{children}</span>;
}

export const StatusBadge = ({ status, rubricApproved }: { status: string; rubricApproved?: boolean }) => {
  const m = statusOf(status, rubricApproved);
  return <Badge tone={m.tone}>{m.label}</Badge>;
};

export const dateTr = (iso: string, withTime = false) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });

export const num = (n: number, digits = 0) => n.toLocaleString('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
