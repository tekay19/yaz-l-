'use client';

// Ayarlar: defaults for new exams, and the account itself.

import { useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { MAX_TEACHER_NOTE } from '@/lib/limits';
import type { GradingStyle } from '@/lib/types';
import { useTeacher } from './context';
import { PageHeader, Tabs } from './ui';

type Tab = 'puanlama' | 'hesap' | 'sil';

const STYLES: { id: GradingStyle; label: string; text: string }[] = [
  { id: 'strict', label: 'Sıkı', text: 'Fikir eksiksiz ve kesin ifade edilmeli; eksik ya da belirsiz anlatım yarım puan alır.' },
  { id: 'balanced', label: 'Dengeli', text: 'Doğru fikir kısa da olsa tam puan alır; eksik kısım yarım puan alır. Önerilen.' },
  { id: 'lenient', label: 'Esnek', text: 'Öğrencinin kendi sözleriyle doğru yöne giden cevabı da puan alır; yanlış ve konu dışı yazı yine puan almaz.' },
];

export default function SettingsPage() {
  const { api, me, refreshMe, signOut } = useTeacher();
  const toast = useToast();
  const [style, setStyle] = useState<GradingStyle>(me.settings?.style ?? 'balanced');
  const [note, setNote] = useState(me.settings?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  // one section at a time, kept in the URL (?sekme=hesap) so a reload stays put
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab = (['puanlama', 'hesap', 'sil'] as const).find((t) => t === params.get('sekme')) ?? 'puanlama';
  const setTab = (t: Tab) => router.replace(t === 'puanlama' ? path : `${path}?sekme=${t}`, { scroll: false });

  async function save() {
    setBusy(true);
    const r = await api.saveSettings({ style, note });
    setBusy(false);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Ayarlar kaydedildi', 'success');
    refreshMe();
  }

  async function deleteAccount() {
    const r = await api.deleteAccount();
    if (!r.ok) { toast(r.error, 'error'); return; }
    window.location.href = '/';
  }

  return (
    <>
      <PageHeader title="Ayarlar" sub="Yeni sınavlarınız bu ayarlarla başlar; her sınavda ayrıca değiştirebilirsiniz." />

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'puanlama', label: 'Puanlama' },
        { id: 'hesap', label: 'Hesap ve şifre' },
        { id: 'sil', label: 'Hesabı silin' },
      ]} />

      <div className="app-card app-sheet">
        {tab === 'puanlama' && <>
        <section className="app-sec" aria-labelledby="set-style">
          <div className="app-sec-head">
            <h2 id="set-style">Klasik sınavlarda puanlama tarzı</h2>
            <p>Açık uçlu cevapların ne kadar cömert puanlanacağı. Rubrik onay ekranında sınav başına değiştirilebilir.</p>
          </div>
          <div className="app-options" role="radiogroup" aria-labelledby="set-style">
            {STYLES.map((s) => (
              <label key={s.id} className={`app-option${style === s.id ? ' on' : ''}`}>
                <input type="radio" name="style" checked={style === s.id} onChange={() => setStyle(s.id)} />
                <strong>{s.label}</strong>
                <span>{s.text}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="app-sec" aria-labelledby="set-note">
          <div className="app-sec-head">
            <h2 id="set-note">Varsayılan notunuz</h2>
            <p>Her yeni klasik sınava eklenir; yapay zekâ kâğıtları okurken ve puanlarken dikkate alır.</p>
          </div>
          <div>
            <textarea className="console-text" maxLength={MAX_TEACHER_NOTE} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={'Örnek: Yazım hatalarına puan kırmayın. Cevaplar kâğıdın arkasında devam edebilir.'} aria-labelledby="set-note" />
            <div className="app-row-actions app-sec-actions">
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Ayarları kaydedin</button>
            </div>
          </div>
        </section>

        </>}

        {tab === 'hesap' && <>
        <section className="app-sec" aria-labelledby="set-account">
          <div className="app-sec-head">
            <h2 id="set-account">Hesap</h2>
            <p>Giriş yaptığınız hesabın bilgileri.</p>
          </div>
          <div>
            <dl className="app-dl">
              {me.name && <div><dt>Ad soyad</dt><dd>{me.name}</dd></div>}
              <div><dt>E-posta</dt><dd>{me.email}{me.verified ? '' : ' (doğrulanmadı)'}</dd></div>
            </dl>
            <div className="app-row-actions app-sec-actions">
              <button type="button" className="btn btn-ghost" onClick={signOut}>Çıkış yapın</button>
            </div>
          </div>
        </section>

        <PasswordCard />
        </>}

        {tab === 'sil' && <section className="app-sec app-danger-zone" aria-labelledby="set-delete">
          <div className="app-sec-head">
            <h2 id="set-delete">Hesabı silin</h2>
            <p>Hesabınız, sınavlarınız, sınıf listeleriniz ve kalan sayfa hakkınız kalıcı olarak silinir. Ödeme kayıtları yasal süre boyunca saklanır.</p>
          </div>
          <div className="app-narrow">
            <div className="field">
              <label htmlFor="confirm-delete">Onaylamak için e-posta adresinizi yazın</label>
              <input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={me.email} autoComplete="off" />
            </div>
            <div className="app-row-actions app-sec-actions">
              <button type="button" className="btn app-danger" disabled={confirm.trim().toLowerCase() !== me.email.toLowerCase()} onClick={deleteAccount}>
                Hesabımı kalıcı olarak silin
              </button>
            </div>
          </div>
        </section>}
      </div>
    </>
  );
}

function PasswordCard() {
  const { api } = useTeacher();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== again) { setError({ field: 'again', text: 'Yeni şifreler birbirini tutmuyor.' }); return; }
    setBusy(true);
    setError(null);
    const r = await api.changePassword(current, next);
    setBusy(false);
    if (!r.ok) { setError({ field: r.body?.field, text: r.error }); return; }
    setCurrent(''); setNext(''); setAgain('');
    toast('Şifreniz değişti; diğer cihazlardaki oturumlar kapandı.', 'success');
  }

  return (
    <section className="app-sec" aria-labelledby="set-pw">
      <div className="app-sec-head">
        <h2 id="set-pw">Şifre</h2>
        <p>Şifreniz değişince bu cihaz dışındaki tüm oturumlarınız kapanır. Şifrenizi hiç belirlemediyseniz çıkış yapıp &quot;Şifremi unuttum&quot;u kullanın.</p>
      </div>
      <form onSubmit={submit} className="app-pw-form">
        <div className="field">
          <label htmlFor="pw-current">Mevcut şifre</label>
          <input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={error?.field === 'current' || undefined} />
        </div>
        <div className="field">
          <label htmlFor="pw-next">Yeni şifre</label>
          <input id="pw-next" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={error?.field === 'next' || undefined} />
          <span className="field-hint">En az 10 karakter; en az bir harf ve bir rakam.</span>
        </div>
        <div className="field">
          <label htmlFor="pw-again">Yeni şifre (tekrar)</label>
          <input id="pw-again" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={error?.field === 'again' || undefined} />
        </div>
        {error && <p className="console-banner err" role="alert">{error.text}</p>}
        <div className="app-row-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !current || !next || !again}>{busy ? 'Kaydediliyor…' : 'Şifremi değiştirin'}</button>
        </div>
      </form>
    </section>
  );
}
