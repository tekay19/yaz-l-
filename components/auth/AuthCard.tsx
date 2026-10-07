'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { LogoMark } from '@/components/LogoMark';
import { takeReturn } from '@/lib/client/resume';
import { Board, ChalkDefs } from '@/components/Board';

// The page every sign-in screen sits in: the form at the left, and the
// classroom board of the landing page at the right, with a graded sheet
// pinned to it. On a phone only the form shows, under a slim board edge.
export function AuthCard({ title, sub, children, foot }: { title: string; sub?: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="auth">
      <ChalkDefs />
      <div className="auth-paper">
        <header className="auth-top">
          <Link href="/" className="app-logo"><LogoMark /><span>SınavOku</span></Link>
        </header>
        <main className="auth-card">
          <h1>{title}</h1>
          {sub && <p className="auth-sub">{sub}</p>}
          {children}
          {foot && <div className="auth-alt">{foot}</div>}
        </main>
        <nav className="auth-foot" aria-label="Yasal metinler">
          <Link href="/kullanim-kosullari">Kullanım Koşulları</Link>
          <Link href="/kvkk">KVKK Aydınlatma Metni</Link>
          <Link href="/gizlilik">Gizlilik</Link>
        </nav>
      </div>
      <AuthBoard />
    </div>
  );
}

// a sheet as the teacher gets it back: read, marked in red pen, totalled
const SHEET: { q: string; a: string; pts: number; max: number; pen?: string }[] = [
  { q: 'Fotosentez hücrenin hangi organelinde gerçekleşir?', a: 'Kloroplastta', pts: 4, max: 4 },
  { q: 'Hücre zarının görevi nedir?', a: 'Hücreye madde giriş çıkışını denetler.', pts: 4, max: 4 },
  { q: 'Mitokondri ile kloroplastın ortak özelliği nedir?', a: 'İkisinde de DNA var.', pts: 3, max: 4, pen: 'zar yapısı eksik' },
  { q: 'Bitki hücresini hayvan hücresinden ayıran iki yapı?', a: 'Hücre duvarı, kloroplast', pts: 4, max: 4 },
  { q: 'Ribozomun görevini yazınız.', a: 'Protein üretir.', pts: 3, max: 4, pen: 'nerede? −1' },
];

function AuthBoard() {
  const total = SHEET.reduce((s, x) => s + x.pts, 0);
  const max = SHEET.reduce((s, x) => s + x.max, 0);
  return (
    <aside className="auth-side" aria-label="SınavOku">
      <Board className="auth-board">
        <p className="auth-board-title chalk">Kâğıt sizden,<br />okuma bizden.</p>
        <figure className="auth-sheet-wrap" aria-label="Okunup puanlanmış örnek kâğıt">
          <i className="auth-magnet" aria-hidden="true" />
          <i className="auth-magnet right" aria-hidden="true" />
          <div className="auth-sheet" aria-hidden="true">
            <div className="auth-sheet-head">
              <div>
                <span className="auth-sheet-k">Adı soyadı</span>
                <span className="auth-sheet-v">Elif Yıldız</span>
              </div>
              <div>
                <span className="auth-sheet-k">Sınıfı</span>
                <span className="auth-sheet-v">9-A</span>
              </div>
              <span className="auth-pen auth-score">{total}/{max}</span>
            </div>
            <p className="auth-sheet-title">Biyoloji, 1. yazılı</p>
            <ol className="auth-sheet-qs">
              {SHEET.map((x, i) => (
                <li key={x.q}>
                  <span className="auth-sheet-n">{i + 1}.</span>
                  <div className="auth-sheet-body">
                    <span className="auth-sheet-q">{x.q}</span>
                    <span className="auth-sheet-a">{x.a}</span>
                    {x.pen && <span className="auth-pen auth-pen-note">{x.pen}</span>}
                  </div>
                  <span className="auth-pen auth-sheet-pts">{x.pts === x.max ? '✓' : ''}{x.pts}</span>
                </li>
              ))}
            </ol>
          </div>
        </figure>
        <ul className="auth-board-ticks">
          <li className="chalk">puanlar siz onaylayana kadar öneri</li>
          <li className="chalk">okunamayan sayfa iade</li>
        </ul>
      </Board>
    </aside>
  );
}

export function Field({
  id, label, error, hint, ...input
}: { id: string; label: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={error ? 'invalid' : undefined} aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...input} />
      {error ? <span id={`${id}-err`} className="field-error">{error}</span>
        : hint ? <span id={`${id}-hint`} className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function PasswordField({
  id, label, value, onChange, error, hint, autoComplete,
}: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; autoComplete: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-pw">
        <input id={id} type={shown ? 'text' : 'password'} required autoComplete={autoComplete} value={value}
          onChange={(e) => onChange(e.target.value)} className={error ? 'invalid' : undefined} aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} />
        <button type="button" className="auth-pw-toggle" onClick={() => setShown((s) => !s)} aria-pressed={shown}
          aria-label={shown ? 'Şifreyi gizleyin' : 'Şifreyi gösterin'}>{shown ? 'Gizle' : 'Göster'}</button>
      </div>
      {error ? <span id={`${id}-err`} className="field-error">{error}</span>
        : hint ? <span id={`${id}-hint`} className="field-hint">{hint}</span> : null}
    </div>
  );
}

// Where to go once signed in: a ?next= path on this site, the upload wizard
// that sent the teacher here, the admin panel for an admin, else the panel.
export function landingAfterSignIn(next: string | null, role: 'teacher' | 'admin') {
  if (next && /^\/(?!\/)[\w\-/?=&%.]*$/.test(next)) return next;
  return takeReturn() ?? (role === 'admin' ? '/admin' : '/hesap');
}
