'use client';

// Ayarlar: defaults for new exams, and the account itself.

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { MAX_TEACHER_NOTE } from '@/lib/limits';
import type { GradingStyle } from '@/lib/types';
import { useTeacher } from './context';
import { PageHeader } from './ui';

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

      <section className="app-card">
        <h2>Klasik sınavlarda puanlama tarzı</h2>
        <p className="small muted">Açık uçlu cevapların ne kadar cömert puanlanacağı. Rubrik onay ekranında sınav başına değiştirilebilir.</p>
        <div className="app-options" role="radiogroup" aria-label="Puanlama tarzı">
          {STYLES.map((s) => (
            <label key={s.id} className={`app-option${style === s.id ? ' on' : ''}`}>
              <input type="radio" name="style" checked={style === s.id} onChange={() => setStyle(s.id)} />
              <strong>{s.label}</strong>
              <span className="small muted">{s.text}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="app-card">
        <h2>Varsayılan notunuz</h2>
        <p className="small muted">Her yeni klasik sınava eklenir; yapay zekâ kâğıtları okurken ve puanlarken dikkate alır.</p>
        <textarea className="console-text" maxLength={MAX_TEACHER_NOTE} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={'Örnek: Yazım hatalarına puan kırmayın. Cevaplar kâğıdın arkasında devam edebilir.'} aria-label="Varsayılan not" />
        <div className="app-row-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Ayarları kaydedin</button>
        </div>
      </section>

      <section className="app-card">
        <h2>Hesap</h2>
        <dl className="app-dl">
          <div><dt>E-posta</dt><dd>{me.email}</dd></div>
          <div><dt>Giriş</dt><dd>Şifresiz, e-postanıza gelen bağlantıyla</dd></div>
        </dl>
        <div className="app-row-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={signOut}>Çıkış yapın</button>
        </div>
      </section>

      <section className="app-card app-danger-zone">
        <h2>Hesabı silin</h2>
        <p className="small muted">Hesabınız, sınavlarınız, sınıf listeleriniz ve kalan sayfa hakkınız kalıcı olarak silinir. Ödeme kayıtları yasal süre boyunca saklanır.</p>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="confirm-delete">Onaylamak için e-posta adresinizi yazın</label>
          <input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={me.email} autoComplete="off" />
        </div>
        <button type="button" className="btn app-danger" style={{ marginTop: 12 }} disabled={confirm.trim().toLowerCase() !== me.email.toLowerCase()} onClick={deleteAccount}>
          Hesabımı kalıcı olarak silin
        </button>
      </section>
    </>
  );
}
