'use client';

// Giriş, kayıt, şifremi unuttum, şifre yenileme ve e-posta doğrulama.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createApi } from '@/components/console/api';
import { AuthCard, Field, PasswordField, landingAfterSignIn } from './AuthCard';

const PW_HINT = 'En az 10 karakter; en az bir harf ve bir rakam.';
type Busy = 'idle' | 'busy';

export function LoginScreen() {
  const api = useMemo(() => createApi(), []);
  const params = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<Busy>('idle');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  // already signed in: straight on
  useEffect(() => {
    api.me().then((r) => {
      if (r.ok) window.location.replace(landingAfterSignIn(next, r.data.role));
      else setChecking(false);
    });
  }, [api, next]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    setError('');
    const r = await api.login(email, password);
    if (!r.ok) { setState('idle'); setError(r.error); return; }
    window.location.replace(landingAfterSignIn(next, r.data.role));
  }

  if (checking) return <div className="app-loading" aria-busy="true" />;
  return (
    <AuthCard title="Giriş yapın" sub="Öğretmen hesabınıza e-posta adresiniz ve şifrenizle girin."
      foot={<>Hesabınız yok mu? <Link href={next ? `/kayit?next=${encodeURIComponent(next)}` : '/kayit'}>Ücretsiz hesap açın</Link></>}>
      <form onSubmit={submit} className="auth-form" noValidate>
        <Field id="login-email" label="E-posta" type="email" required autoComplete="email" inputMode="email"
          placeholder="ad.soyad@okul.k12.tr" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField id="login-password" label="Şifre" autoComplete="current-password" value={password} onChange={setPassword} />
        <div className="auth-row"><Link href="/sifremi-unuttum">Şifremi unuttum</Link></div>
        {error && <p className="console-banner err" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={state === 'busy' || !email || !password}>
          {state === 'busy' ? 'Giriş yapılıyor…' : 'Giriş yapın'}
        </button>
      </form>
    </AuthCard>
  );
}

type RegErrors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

export function RegisterScreen() {
  const api = useMemo(() => createApi(), []);
  const next = useSearchParams().get('next');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<Busy>('idle');
  const [errors, setErrors] = useState<RegErrors>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!agree) { setErrors({ form: 'Devam etmek için Kullanım Koşulları ve KVKK Aydınlatma Metni\'ni onaylayın.' }); return; }
    setState('busy');
    setErrors({});
    const r = await api.register(name, email, password);
    if (!r.ok) {
      setState('idle');
      const field = r.body?.field as keyof RegErrors | undefined;
      setErrors(field ? { [field]: r.error } : { form: r.error });
      return;
    }
    window.location.replace(landingAfterSignIn(next, r.data.role));
  }

  return (
    <AuthCard title="Hesap açın" sub="Kayıt ücretsizdir. Sınav yüklemeden önce e-posta adresinizi doğrularsınız."
      foot={<>Zaten hesabınız var mı? <Link href={next ? `/giris?next=${encodeURIComponent(next)}` : '/giris'}>Giriş yapın</Link></>}>
      <form onSubmit={submit} className="auth-form" noValidate>
        <Field id="reg-name" label="Ad soyad" required autoComplete="name" maxLength={80}
          value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Field id="reg-email" label="E-posta" type="email" required autoComplete="email" inputMode="email"
          placeholder="ad.soyad@okul.k12.tr" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <PasswordField id="reg-password" label="Şifre" autoComplete="new-password" value={password} onChange={setPassword}
          error={errors.password} hint={PW_HINT} />
        <label className="auth-check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            <Link href="/kullanim-kosullari" target="_blank">Kullanım Koşulları</Link>&apos;nı ve{' '}
            <Link href="/kvkk" target="_blank">KVKK Aydınlatma Metni</Link>&apos;ni okudum, kabul ediyorum.
          </span>
        </label>
        {errors.form && <p className="console-banner err" role="alert">{errors.form}</p>}
        {errors.email?.includes('hesap var') && (
          <p className="small muted"><Link href="/giris">Giriş yapın</Link> ya da <Link href="/sifremi-unuttum">şifrenizi sıfırlayın</Link>.</p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={state === 'busy'}>
          {state === 'busy' ? 'Hesap açılıyor…' : 'Hesabımı açın'}
        </button>
      </form>
    </AuthCard>
  );
}

export function ForgotScreen() {
  const api = useMemo(() => createApi(), []);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<Busy | 'sent'>('idle');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    setError('');
    const r = await api.forgot(email);
    if (!r.ok) { setState('idle'); setError(r.error); return; }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <AuthCard title="E-postanızı kontrol edin"
        sub={<>Bu adrese kayıtlı bir hesap varsa <strong>{email}</strong> adresine şifre yenileme bağlantısı gönderdik. Bağlantı 30 dakika geçerlidir; gelmediyse spam klasörüne bakın.</>}
        foot={<Link href="/giris">Giriş sayfasına dönün</Link>}>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setState('idle')}>Başka bir adres deneyin</button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Şifrenizi mi unuttunuz?"
      sub="E-posta adresinizi yazın, şifrenizi yenilemeniz için bir bağlantı gönderelim. Daha önce e-postadaki bağlantıyla giriş yaptıysanız şifrenizi de buradan belirlersiniz."
      foot={<Link href="/giris">Giriş sayfasına dönün</Link>}>
      <form onSubmit={submit} className="auth-form" noValidate>
        <Field id="forgot-email" label="E-posta" type="email" required autoComplete="email" inputMode="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p className="console-banner err" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={state === 'busy' || !email}>
          {state === 'busy' ? 'Gönderiliyor…' : 'Yenileme bağlantısı gönderin'}
        </button>
      </form>
    </AuthCard>
  );
}

export function ResetScreen() {
  const api = useMemo(() => createApi(), []);
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [state, setState] = useState<Busy>('idle');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== again) { setError('Şifreler birbirini tutmuyor.'); return; }
    setState('busy');
    setError('');
    const r = await api.reset(token, password);
    if (!r.ok) { setState('idle'); setError(r.error); return; }
    window.location.replace(r.data.role === 'admin' ? '/admin' : '/hesap');
  }

  if (!token) {
    return (
      <AuthCard title="Bağlantı eksik" sub="Bu sayfaya e-postanızdaki şifre yenileme bağlantısıyla gelin."
        foot={<Link href="/sifremi-unuttum">Yeni bağlantı isteyin</Link>}><span /></AuthCard>
    );
  }
  return (
    <AuthCard title="Yeni şifre belirleyin" sub="Yeni şifrenizle diğer cihazlardaki oturumlarınız kapanır."
      foot={<Link href="/sifremi-unuttum">Yeni bağlantı isteyin</Link>}>
      <form onSubmit={submit} className="auth-form" noValidate>
        <PasswordField id="reset-password" label="Yeni şifre" autoComplete="new-password" value={password} onChange={setPassword} hint={PW_HINT} />
        <PasswordField id="reset-again" label="Yeni şifre (tekrar)" autoComplete="new-password" value={again} onChange={setAgain} />
        {error && <p className="console-banner err" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={state === 'busy' || !password || !again}>
          {state === 'busy' ? 'Kaydediliyor…' : 'Şifremi kaydedin'}
        </button>
      </form>
    </AuthCard>
  );
}

// Mail scanners may open the link; the token is spent only by this page's
// POST, which a scanner does not run.
export function VerifyScreen() {
  const api = useMemo(() => createApi(), []);
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'busy' | 'ok' | { error: string }>('busy');
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (!token) { setState({ error: 'Doğrulama bağlantısı eksik.' }); return; }
    api.verify(token).then((r) => setState(r.ok ? 'ok' : { error: r.error }));
  }, [api, token]);

  if (state === 'busy') return <AuthCard title="E-posta doğrulanıyor…" sub="Bağlantınız kontrol ediliyor; bu sayfa kendiliğinden ilerler."><span aria-busy="true" /></AuthCard>;
  if (state === 'ok') {
    return (
      <AuthCard title="E-postanız doğrulandı" sub="Artık sınav yükleyebilir ve paket satın alabilirsiniz.">
        <Link href="/hesap" className="btn btn-primary btn-block">Panelime gidin</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Doğrulanamadı" sub={state.error}>
      <Link href="/hesap" className="btn btn-ghost btn-block">Panelinizden yeni bağlantı isteyin</Link>
    </AuthCard>
  );
}
