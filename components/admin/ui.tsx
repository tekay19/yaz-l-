'use client';

// The admin panel's building blocks: data loading, URL-kept list state,
// tables, chips, paging and inline confirmations.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { request } from '@/lib/client/request';
import type { Label, Tone } from './format';
import { num } from './format';

// ---- data ------------------------------------------------------------------

export function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let live = true;
    setLoading(true);
    request<T>(url).then((r) => {
      if (!live) return;
      if (r.ok) { setData(r.data); setError(null); } else setError(r.error);
      setLoading(false);
    });
    return () => { live = false; };
  }, [url, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

// list state (q, filtre, sayfa, …) lives in the URL so a view can be shared and reloaded
export function useQueryState() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const get = useCallback((k: string, fallback = '') => params.get(k) ?? fallback, [params]);
  const set = useCallback((patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === 'all' || (k === 'sayfa' && Number(v) <= 1)) next.delete(k);
      else next.set(k, String(v));
    }
    const s = next.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  }, [params, router, path]);
  return { get, set };
}

// true below `px`: a detail page then moves its side column into its tabs,
// so a phone never scrolls through every panel stacked on top of each other
export function useNarrow(px = 1100) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${px}px)`);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [px]);
  return narrow;
}

// ---- layout pieces -----------------------------------------------------------

export function Header({ title, sub, back, actions }: {
  title: React.ReactNode; sub?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode;
}) {
  return (
    <header className="adm-head">
      {back && <Link href={back.href} className="adm-back"><Chevron />{back.label}</Link>}
      <div className="adm-head-row">
        <div className="adm-head-text">
          <h1>{title}</h1>
          {sub && <div className="adm-sub">{sub}</div>}
        </div>
        {actions && <div className="adm-head-actions">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({ title, aside, children, flush, className }: {
  title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; flush?: boolean; className?: string;
}) {
  return (
    <div className={`adm-card${flush ? ' flush' : ''}${className ? ` ${className}` : ''}`}>
      {(title || aside) && (
        <div className="adm-card-head">
          {title && <h2>{title}</h2>}
          {aside && <div className="adm-card-aside">{aside}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ tone = 'grey', children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return <span className={`adm-badge ${tone}`} title={title}>{children}</span>;
}

export function StateBadge({ map, value }: { map: Record<string, Label>; value: string }) {
  const m = map[value] ?? { label: value, tone: 'grey' as Tone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export type StatItem = {
  label: string; value: React.ReactNode; hint?: React.ReactNode;
  // mark = needs attention (red pen), warn = worth a look (amber)
  tone?: 'mark' | 'warn'; href?: string;
};

function StatCell({ s }: { s: StatItem }) {
  const body = (
    <>
      <span className="k">{s.label}</span>
      <span className="v">{s.value}</span>
      {s.hint && <span className="h">{s.hint}</span>}
    </>
  );
  const cls = `adm-stat${s.tone ? ` ${s.tone}` : ''}${s.href ? ' link' : ''}`;
  return s.href ? <Link href={s.href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

// one ruled strip of figures: a single surface split by vertical rules, not a row of cards
export function StatStrip({ items, label }: { items: StatItem[]; label?: string }) {
  return (
    <section className={`adm-stats n-${items.length}`} aria-label={label} style={{ '--n': items.length } as React.CSSProperties}>
      {items.map((s) => <StatCell key={s.label} s={s} />)}
    </section>
  );
}

// the overview's figures laid out like a grade book: one ruled row per subject, the same columns down the page
export function StatLedger({ groups, label }: {
  groups: { title: string; href?: string; items: StatItem[] }[]; label?: string;
}) {
  return (
    <section className="adm-ledger" aria-label={label}>
      {groups.map((g) => (
        <div key={g.title} className="adm-ledger-row" role="group" aria-label={g.title}>
          <div className="adm-ledger-head">
            {g.href ? <Link href={g.href}>{g.title}</Link> : <span>{g.title}</span>}
          </div>
          {g.items.map((s) => <StatCell key={s.label} s={s} />)}
        </div>
      ))}
    </section>
  );
}

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
);

export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="adm-loading" aria-busy="true" aria-live="polite">
      <span className="sr-only">Yükleniyor…</span>
      {Array.from({ length: rows }, (_, i) => <span key={i} className="adm-skel" style={{ width: `${92 - (i % 3) * 14}%` }} />)}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="adm-error" role="alert">
      <span>{error}</span>
      {onRetry && <button type="button" className="adm-btn sm" onClick={onRetry}>Tekrar dene</button>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="adm-empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

// ---- list controls ------------------------------------------------------------

export function Chips<T extends string>({ options, value, onChange, label }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="adm-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} className={value === o.id ? 'on' : undefined} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// a search box that waits for the typing to stop before it changes the URL
export function SearchBox({ value, onChange, placeholder, label }: {
  value: string; onChange: (v: string) => void; placeholder: string; label: string;
}) {
  const [text, setText] = useState(value);
  const first = useRef(true);
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => { setText(value); }, [value]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (text === value) return;
    const t = setTimeout(() => cb.current(text.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <label className="adm-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
      <span className="sr-only">{label}</span>
      <input type="search" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
    </label>
  );
}

export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  return (
    <nav className="adm-pager" aria-label="Sayfalar">
      <span className="adm-pager-info">{num(total)} kayıttan {num(from)}–{num(to)}</span>
      <div className="adm-pager-btns">
        <button type="button" className="adm-btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Önceki</button>
        <span className="adm-pager-page">Sayfa {num(page)} / {num(pages)}</span>
        <button type="button" className="adm-btn sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Sonraki</button>
      </div>
    </nav>
  );
}

// a row that opens a detail page; the first cell still carries a real link for keyboards
export function useRowNav() {
  const router = useRouter();
  return (href: string) => ({
    onClick: (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
      if (e.metaKey || e.ctrlKey) { window.open(href, '_blank'); return; }
      router.push(href);
    },
    className: 'adm-row-link',
  });
}

// ---- inline confirmation ---------------------------------------------------------

export function Confirm({ label, question, confirmLabel, danger, disabled, onConfirm }: {
  label: string; question: string; confirmLabel: string; danger?: boolean; disabled?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return <button type="button" className={`adm-btn${danger ? ' danger-ghost' : ''}`} disabled={disabled} onClick={() => setOpen(true)}>{label}</button>;
  }
  return (
    <div className={`adm-confirm${danger ? ' danger' : ''}`} role="group" aria-label={question}>
      <span>{question}</span>
      <div className="adm-confirm-btns">
        <button type="button" className={`adm-btn sm ${danger ? 'danger' : 'primary'}`} disabled={busy} autoFocus
          onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); setOpen(false); }}>
          {busy ? 'Yapılıyor…' : confirmLabel}
        </button>
        <button type="button" className="adm-btn sm" disabled={busy} onClick={() => setOpen(false)}>Vazgeç</button>
      </div>
    </div>
  );
}

export function Notice({ kind, children, onClose }: { kind: 'ok' | 'err'; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className={`adm-notice ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && <button type="button" className="adm-notice-x" onClick={onClose} aria-label="Kapat">×</button>}
    </div>
  );
}

// a horizontal bar list for "top N" breakdowns
export function BarList({ rows, format = (n) => num(n), empty = 'Veri yok.' }: {
  rows: { name: string; value: number; hint?: string }[]; format?: (n: number) => string; empty?: string;
}) {
  if (!rows.length) return <p className="adm-muted adm-pad">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="adm-barlist">
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${format(r.value)}`}>
          <span className="fill" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} aria-hidden="true" />
          <span className="name">{r.name}</span>
          <span className="val">{format(r.value)}{r.hint && <small> {r.hint}</small>}</span>
        </li>
      ))}
    </ul>
  );
}

export function Dl({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="adm-dl">
      {items.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void;
}) {
  return (
    <div className="adm-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : undefined} onClick={() => onChange(t.id)}>
          {t.label}
          {typeof t.count === 'number' && <span className="adm-tab-count">{num(t.count)}</span>}
        </button>
      ))}
    </div>
  );
}
