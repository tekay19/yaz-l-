'use client';

// The admin panel's frame: a chalkboard-green sidebar (so it is never mistaken
// for the teacher's white one), the sections, and who is signed in.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/LogoMark';
import { IconClose, IconExams, IconLogout, IconMenu, IconWallet, IconClasses, IconClock } from '@/components/app/icons';
import { logout } from './api';

const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
  </svg>
);
const IconChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h16" /><path d="M7 16v-5" /><path d="M12 16V7" /><path d="M17 16v-8" />
  </svg>
);

const NAV = [
  { href: '/admin', label: 'Genel bakış', icon: IconHome, exact: true },
  { href: '/admin/ogretmenler', label: 'Öğretmenler', icon: IconClasses },
  { href: '/admin/sinavlar', label: 'Sınavlar', icon: IconExams },
  { href: '/admin/odemeler', label: 'Ödemeler', icon: IconWallet },
  { href: '/admin/analitik', label: 'Ziyaretçi analitiği', icon: IconChart },
  { href: '/admin/kayitlar', label: 'İşlem kaydı', icon: IconClock },
];

export default function AdminShell({ me, children }: { me: { name: string; email: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { setMenu(false); }, [path]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
  async function signOut() {
    setLeaving(true);
    await logout();
    window.location.href = '/giris';
  }

  return (
    <div className={`adm${menu ? ' menu-open' : ''}`}>
      <aside className="adm-side" id="adm-side" aria-label="Yönetim menüsü">
        <div className="adm-brand">
          <Link href="/admin" className="adm-logo"><LogoMark /><span className="adm-logo-text">SınavOku<small>Yönetim</small></span></Link>
          <button type="button" className="adm-icon-btn adm-only-sm" onClick={() => setMenu(false)} aria-label="Menüyü kapat"><IconClose /></button>
        </div>
        <nav className="adm-nav">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const on = active(href, exact);
            return (
              <Link key={href} href={href} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined}>
                <Icon /><span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="adm-side-foot">
          <Link href="/hesap" className="adm-switch">Öğretmen paneline geç</Link>
          <div className="adm-user">
            <span className="adm-avatar" aria-hidden="true">{(me.name || me.email)[0]?.toUpperCase()}</span>
            <span className="adm-user-text">
              <strong title={me.name}>{me.name || 'Yönetici'}</strong>
              <span title={me.email}>{me.email}</span>
            </span>
            <button type="button" className="adm-icon-btn" onClick={signOut} disabled={leaving} aria-label="Çıkış yap" title="Çıkış yap"><IconLogout /></button>
          </div>
        </div>
      </aside>
      <div className="adm-scrim" onClick={() => setMenu(false)} aria-hidden="true" />
      <div className="adm-main">
        <header className="adm-top">
          <button type="button" className="adm-icon-btn" onClick={() => setMenu(true)} aria-label="Menüyü aç" aria-controls="adm-side" aria-expanded={menu}><IconMenu /></button>
          <Link href="/admin" className="adm-logo"><LogoMark /><span className="adm-logo-text">SınavOku<small>Yönetim</small></span></Link>
        </header>
        <main className="adm-content">{children}</main>
      </div>
    </div>
  );
}
