'use client';

// The teacher's panel at /hesap: a sidebar with the panel's sections, a top
// bar with the page balance, and the screens inside. A signed-out visitor
// gets the sign-in card instead. Sign-in and payment both land on /hesap;
// a wizard that sent the teacher away is reopened where it was.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createApi, type Me } from '@/components/console/api';
import { LogoMark } from '@/components/admin/AdminShell';
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
    setMe(null);
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
  }, [me, payment, toast]);

  if (me === undefined || leaving) return <div className="app-loading" aria-busy="true" />;
  if (me === null) return <SignIn api={api} linkFailed={params.get('hata') === 'baglanti'} />;

  const active = (href: string, exact?: boolean) => (exact ? path === href || path.startsWith('/hesap/sinav') : path.startsWith(href));
  return (
    <TeacherContext.Provider value={{ api, me, refreshMe, signOut }}>
      <div className={`app${menu ? ' menu-open' : ''}`}>
        <aside className="app-side" aria-label="Panel menüsü">
          <div className="app-brand">
            <Link href="/hesap" className="app-logo"><LogoMark /><span>SınavOku</span></Link>
            <button type="button" className="app-icon-btn app-only-sm" onClick={() => setMenu(false)} aria-label="Menüyü kapat"><IconClose /></button>
          </div>
          <Link href="/yukle" className="btn btn-primary app-new"><IconPlus size={17} /> Yeni sınav yükleyin</Link>
          <nav className="app-nav">
            {NAV.map(({ href, label, icon: Icon, exact }) => (
              <Link key={href} href={href} className={active(href, exact) ? 'on' : undefined} aria-current={active(href, exact) ? 'page' : undefined}>
                <Icon /> {label}
              </Link>
            ))}
          </nav>
          <div className="app-side-foot">
            <Link href="/hesap/paket" className="app-balance">
              <span className="k">Sayfa hakkınız</span>
              <span className="v">{me.pageBalance.toLocaleString('tr-TR')}</span>
            </Link>
            <div className="app-user">
              <span className="app-avatar" aria-hidden="true">{me.email[0]?.toUpperCase()}</span>
              <span className="app-email" title={me.email}>{me.email}</span>
              <button type="button" className="app-icon-btn" onClick={signOut} aria-label="Çıkış yapın" title="Çıkış yapın"><IconLogout /></button>
            </div>
          </div>
        </aside>
        <div className="app-scrim" onClick={() => setMenu(false)} aria-hidden="true" />
        <div className="app-main">
          <header className="app-top app-only-sm">
            <button type="button" className="app-icon-btn" onClick={() => setMenu(true)} aria-label="Menüyü açın"><IconMenu /></button>
            <Link href="/hesap" className="app-logo"><LogoMark /><span>SınavOku</span></Link>
            <Link href="/hesap/paket" className="app-pill">{me.pageBalance} sayfa</Link>
          </header>
          <main className="app-content">{children}</main>
        </div>
      </div>
    </TeacherContext.Provider>
  );
}

function SignIn({ api, linkFailed }: { api: ReturnType<typeof createApi>; linkFailed: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | { error: string }>('idle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    const r = await api.login(email);
    setState(r.ok ? 'sent' : { error: r.error });
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <Link href="/" className="app-logo"><LogoMark /><span>SınavOku</span></Link>
        {state === 'sent' ? (
          <>
            <h1>E-postanızı kontrol edin</h1>
            <p className="muted"><strong>{email}</strong> adresine bir giriş bağlantısı gönderdik. Bağlantı 15 dakika geçerli; gelmediyse spam klasörüne bakın.</p>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setState('idle')}>Başka bir adres deneyin</button>
          </>
        ) : (
          <>
            <h1>Öğretmen paneline giriş</h1>
            <p className="muted">Şifre yok: e-postanıza gelen bağlantıyla giriş yaparsınız. İlk girişte hesabınız açılır.</p>
            {linkFailed && <p className="console-banner err">Giriş bağlantısı geçersiz ya da süresi dolmuş. Yeni bağlantı isteyin.</p>}
            <form onSubmit={submit} className="auth-form">
              <div className="field">
                <label htmlFor="auth-email">E-posta adresiniz</label>
                <input id="auth-email" type="email" required autoComplete="email" placeholder="ad.soyad@okul.k12.tr"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={state === 'busy'}>
                {state === 'busy' ? 'Gönderiliyor…' : 'Giriş bağlantısı gönderin'}
              </button>
              {typeof state === 'object' && <p className="console-banner err">{state.error}</p>}
            </form>
          </>
        )}
        <p className="auth-foot tiny muted">
          <Link href="/kullanim-kosullari">Kullanım Koşulları</Link> · <Link href="/kvkk">KVKK Aydınlatma Metni</Link> · <Link href="/gizlilik">Gizlilik</Link>
        </p>
      </div>
    </div>
  );
}
