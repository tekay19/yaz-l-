'use client';

// The teacher's panel at /hesap: a sidebar with the panel's sections, a top
// bar with the page balance, and the screens inside. A signed-out visitor is
// sent to /giris and comes back here. Payment lands on /hesap too; a wizard
// that sent the teacher away is reopened where it was.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChalkDefs } from '@/components/Board';
import { usePathname, useSearchParams } from 'next/navigation';
import { createApi, type Me } from '@/components/console/api';
import { LogoMark } from '@/components/LogoMark';
import { useToast } from '@/components/Toast';
import { takeReturn } from '@/lib/client/resume';
import { TeacherContext } from './context';
import { IconClasses, IconClose, IconExams, IconLogout, IconMenu, IconPlus, IconSettings, IconWallet } from './icons';

const NAV = [
  { href: '/hesap', label: 'Sınavlarım', icon: IconExams, exact: true },
  { href: '/hesap/siniflar', label: 'Sınıflarım', icon: IconClasses },
  { href: '/hesap/paket', label: 'Paket ve ödemeler', icon: IconWallet },
  { href: '/hesap/ayarlar', label: 'Ayarlar', icon: IconSettings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const api = useMemo(() => createApi(), []);
  const path = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const payment = params.get('odeme');

  const refreshMe = useCallback(async () => {
    const r = await api.me();
    setMe(r.ok ? r.data : null);
  }, [api]);
  const signOut = useCallback(async () => {
    await api.logout();
    window.location.replace('/giris');
  }, [api]);

  useEffect(() => { refreshMe(); }, [refreshMe]);
  useEffect(() => { setMenu(false); }, [path]);

  // back from the sign-in link or the payment page to the wizard that sent us
  useEffect(() => {
    if (!me) return;
    const back = takeReturn();
    if (back) {
      setLeaving(true);
      window.location.replace(payment ? `${back}${back.includes('?') ? '&' : '?'}odeme=${payment}` : back);
      return;
    }
    if (payment === 'ok') toast('Ödeme alındı; sayfa hakkınız hesabınıza eklendi.', 'success');
    if (payment === 'hata') toast('Ödeme tamamlanamadı; sayfa hakkı eklenmedi.', 'error');
    if (payment === 'bekliyor') toast('Ödemeniz kontrol ediliyor; onaylanınca sayfa hakkınız birkaç dakika içinde eklenir.', 'success');
  }, [me, payment, toast]);

  // signed out: to the sign-in page, back here afterwards
  useEffect(() => {
    if (me !== null) return;
    const here = `${path}${params.toString() ? `?${params}` : ''}`;
    window.location.replace(`/giris?next=${encodeURIComponent(here)}`);
  }, [me, path, params]);

  if (me === undefined || me === null || leaving) return <div className="app-loading" aria-busy="true" />;

  const active = (href: string, exact?: boolean) => (exact ? path === href || path.startsWith('/hesap/sinav') : path.startsWith(href));
  return (
    <TeacherContext.Provider value={{ api, me, refreshMe, signOut }}>
      <ChalkDefs />
      <div className={`app${menu ? ' menu-open' : ''}`}>
        <aside className="app-side chalk-side" aria-label="Panel menüsü">
          <div className="app-brand">
            <Link href="/hesap" className="app-logo"><LogoMark /><span>SınavOku</span></Link>
            <button type="button" className="app-icon-btn app-only-sm" onClick={() => setMenu(false)} aria-label="Menüyü kapat"><IconClose /></button>
          </div>
          <Link href="/yukle" className="btn btn-primary app-new"><IconPlus size={17} /> Yeni sınav yükleyin</Link>
          <nav className="app-nav">
            {NAV.map(({ href, label, icon: Icon, exact }) => (
              <Link key={href} href={href} className={active(href, exact) ? 'on' : undefined} aria-current={active(href, exact) ? 'page' : undefined}>
                {active(href, exact) && <i className="chalk-mark" aria-hidden="true" />}
                <Icon /> {label}
              </Link>
            ))}
          </nav>
          <div className="app-side-foot">
            <Link href="/hesap/paket" className="app-balance">
              <span className="k">Sayfa hakkınız</span>
              <span className="v">{me.pageBalance.toLocaleString('tr-TR')}</span>
              <span className="h">Sayfa hakkı ekleyin</span>
            </Link>
            <div className="app-user">
              <span className="app-avatar" aria-hidden="true">{(me.name || me.email)[0]?.toLocaleUpperCase('tr-TR')}</span>
              <span className="app-email" title={me.email}>{me.name || me.email}</span>
              <button type="button" className="app-icon-btn" onClick={signOut} aria-label="Çıkış yapın" title="Çıkış yapın"><IconLogout /></button>
            </div>
          </div>
        </aside>
        <div className="app-scrim" onClick={() => setMenu(false)} aria-hidden="true" />
        <div className="app-main">
          <header className="app-top app-only-sm">
            <button type="button" className="app-icon-btn" onClick={() => setMenu(true)} aria-label="Menüyü açın"><IconMenu /></button>
            <Link href="/hesap" className="app-logo"><LogoMark /><span>SınavOku</span></Link>
            <Link href="/hesap/paket" className="app-pill" aria-label={`Sayfa hakkınız: ${me.pageBalance}`}>{me.pageBalance.toLocaleString('tr-TR')} sayfa</Link>
          </header>
          <main className="app-content">
            {!me.verified && <VerifyBanner api={api} email={me.email} />}
            {children}
          </main>
        </div>
      </div>
    </TeacherContext.Provider>
  );
}

function VerifyBanner({ api, email }: { api: ReturnType<typeof createApi>; email: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function resend() {
    setBusy(true);
    const r = await api.resendVerification();
    setBusy(false);
    toast(r.ok ? 'Doğrulama bağlantısı yeniden gönderildi.' : r.error, r.ok ? 'success' : 'error');
  }
  return (
    <div className="app-verify" role="status">
      <svg className="app-verify-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
      </svg>
      <p>
        <strong>E-posta adresinizi doğrulayın.</strong>{' '}
        <span><b className="app-verify-mail">{email}</b> adresine gönderdiğimiz bağlantıyı açın; doğrulamadan sınav yüklenemez ve paket alınamaz.</span>
      </p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={resend} disabled={busy}>{busy ? 'Gönderiliyor…' : 'Bağlantıyı yeniden gönderin'}</button>
    </div>
  );
}
