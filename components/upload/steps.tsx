'use client';

// The four screens of the upload wizard. They only show and edit what the
// wizard holds; saving, uploading and paying stay in UploadWizard.

import { useState } from 'react';
import Link from 'next/link';
import type { ClassView, createApi } from '@/components/console/api';
import PackageOptions from '@/components/PackageOptions';
import { useToast } from '@/components/Toast';
import type { PackName } from '@/lib/packs';
import { MAX_KEY_PAGES, MAX_TEACHER_NOTE } from '@/lib/limits';
import PhotoDrop, { PER_PICK_KEY, PER_PICK_STUDENT } from './PhotoDrop';
import RosterPhoto, { mergeNames } from './RosterPhoto';
import { PhotoTips } from './PhotoGrid';

type Mode = 'optik' | 'klasik';
type Pick = (files: File[]) => void;

export function ExamStep({ api, showMode, mode, setMode, created, title, setTitle, classes, roster, setRoster, saveAs, setSaveAs }: {
  api: ReturnType<typeof createApi>;
  showMode: boolean; mode: Mode; setMode: (m: Mode) => void; created: boolean;
  title: string; setTitle: (v: string) => void; classes: ClassView[];
  roster: string; setRoster: (v: string) => void; saveAs: string; setSaveAs: (v: string) => void;
}) {
  return (
    <>
      {showMode && (
        <div className="field-block">
          <p className="field-block-label">Sınav türü</p>
          <div className="seg" role="group" aria-label="Sınav türü">
            {(['optik', 'klasik'] as const).map((m) => (
              <button key={m} type="button" className={mode === m ? 'on' : undefined} disabled={created} onClick={() => setMode(m)}>
                {m === 'optik' ? 'Çoktan seçmeli' : 'Klasik (açık uçlu)'}
              </button>
            ))}
          </div>
          {created && <p className="tiny muted" style={{ marginTop: 6 }}>Sınav oluşturuldu; türü değiştirmek için yeni sınav başlatın.</p>}
        </div>
      )}
      <div className="field">
        <label htmlFor="exam-title">Sınavın adı</label>
        <input id="exam-title" value={title} disabled={created} onChange={(e) => setTitle(e.target.value)} placeholder="9-B Matematik 1. yazılı" />
      </div>
      <div className="field">
        <label htmlFor="exam-roster">Sınıf listesi <span className="muted">(önerilir)</span></label>
        {classes.length > 0 && (
          <select className="wizard-select" aria-label="Kayıtlı sınıftan seçin" value=""
            onChange={(e) => { const c = classes.find((x) => x.id === e.target.value); if (c) setRoster(c.students.join('\n')); }}>
            <option value="">Kayıtlı sınıflarınızdan seçin…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.students.length} öğrenci)</option>)}
          </select>
        )}
        <textarea id="exam-roster" className="console-text" value={roster} onChange={(e) => setRoster(e.target.value)}
          placeholder={'Her satıra bir öğrenci\nElif Yılmaz\nMert Kaya'} />
        <RosterPhoto api={api} onNames={(names) => setRoster(mergeNames(roster, names))} />
        <span className="field-hint">Kâğıttaki isimler bu listeyle eşleştirilir; birkaç sayfalık sınavda sayfalar isimden aynı öğrencide toplanır. e-Okul&apos;dan kopyalayıp yapıştırabilirsiniz.</span>
        {roster.trim() && !classes.some((c) => c.students.join('\n') === roster.trim()) && (
          <label className="console-check">
            <input type="checkbox" checked={Boolean(saveAs)} onChange={(e) => setSaveAs(e.target.checked ? title.split(' ')[0] || 'Sınıf' : '')} />
            <span>Bu listeyi sınıf olarak kaydedin
              {saveAs && <input className="wizard-inline" value={saveAs} onChange={(e) => setSaveAs(e.target.value)} aria-label="Sınıfın adı" maxLength={60} />}
            </span>
          </label>
        )}
      </div>
    </>
  );
}

export function KeyStep({ klasik, uploading, keyCount, onPick, grid, keyText, setKeyText }: {
  klasik: boolean; uploading: boolean; keyCount: number; onPick: Pick; grid: React.ReactNode;
  keyText: string; setKeyText: (v: string) => void;
}) {
  return (
    <>
      <PhotoDrop
        title={klasik ? 'Cevap anahtarınızın fotoğrafları' : 'Cevap anahtarının fotoğrafı'}
        hint={klasik ? 'Birden fazla sayfa olabilir; sırayla ekleyin.' : 'Doğru şıkların işaretli olduğu tek sayfa. Yenisi eskisinin yerine geçer.'}
        busy={uploading}
        single={!klasik}
        perPick={PER_PICK_KEY}
        full={klasik && keyCount >= MAX_KEY_PAGES}
        onPick={onPick}
      />
      {grid}
      {klasik && (
        <div className="field" style={{ marginTop: 22 }}>
          <label htmlFor="key-text">Ya da anahtarı yazın / yapıştırın</label>
          <textarea id="key-text" className="console-text" value={keyText} onChange={(e) => setKeyText(e.target.value)}
            placeholder={'1) 2x + 3 = 11 → 2x = 8 → x = 4 (10 puan)\n2) Lirik şiir duygu ve coşkuyu anlatır… (15 puan)'} />
          <span className="field-hint">Word&apos;deki anahtarınızı yapıştırabilirsiniz; fotoğrafla birlikte de kullanılabilir.</span>
        </div>
      )}
    </>
  );
}

export function StudentsStep({ uploading, onPick, grid, names, need }: {
  uploading: boolean; onPick: Pick; grid: React.ReactNode; names: string[]; need: number;
}) {
  const missing = names.length > 0 && need < names.length;
  return (
    <>
      <PhotoDrop
        title="Öğrenci kâğıtları"
        hint={`Her seferde en fazla ${PER_PICK_STUDENT} fotoğraf. Bir öğrencinin sayfalarını sırayla ekleyin (ön yüz, arka yüz, sonraki sayfalar). Sayfalarda isim yazıyorsa sıra karışsa da isimden toplanır.`}
        busy={uploading}
        perPick={PER_PICK_STUDENT}
        onPick={onPick}
      />
      <PhotoTips />
      {grid}
      {missing && (
        <p className="console-banner warn">
          Sınıf listesinde {names.length} öğrenci var, {need} sayfa eklendi. Eksik kâğıt varsa şimdi ekleyin.
        </p>
      )}
    </>
  );
}

// No class list yet: the last chance to give one, typed or from a photo.
// Without it a misread name ("Deniz Köş") can count as a student of its own.
function RosterMissing({ api, onSave, noRoster, setNoRoster }: {
  api: ReturnType<typeof createApi>; onSave: (text: string) => Promise<void>; noRoster: boolean; setNoRoster: (v: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="wizard-roster-missing">
      <p className="console-banner warn">
        Sınıf listesi eklenmedi. Liste olmadan isimler yalnız fotoğraftan okunur: yanlış okunan bir isim (ör. &quot;Deniz Köş&quot;)
        ayrı bir öğrenci sayılabilir. Listeyi eklerseniz her isim listedeki en yakın isimle eşleştirilir.
      </p>
      <textarea className="console-text" value={text} onChange={(e) => setText(e.target.value)} aria-label="Sınıf listesi"
        placeholder={'Her satıra bir öğrenci\nElif Yılmaz\nMert Kaya'} />
      <div className="console-row">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}
          onClick={async () => { setBusy(true); await onSave(text); setBusy(false); }}>Listeyi ekleyin</button>
      </div>
      <RosterPhoto api={api} onNames={(names) => setText((cur) => mergeNames(cur, names))} />
      <label className="console-check">
        <input type="checkbox" checked={noRoster} onChange={(e) => setNoRoster(e.target.checked)} />
        Sınıf listesi olmadan devam et: isimler yalnız fotoğraftan okunur, bir listeyle karşılaştırılmaz.
      </label>
    </div>
  );
}

export function ReviewStep(p: {
  api: ReturnType<typeof createApi>; onSaveRoster: (text: string) => Promise<void>;
  title: string; klasik: boolean; keyCount: number; need: number; balance: number; names: string[];
  noRoster: boolean; setNoRoster: (v: boolean) => void; note: string; setNote: (v: string) => void;
  consent: boolean; setConsent: (v: boolean) => void; onAddPages: () => void; onBuy: (name: PackName) => void;
}) {
  const { api, onSaveRoster, title, klasik, keyCount, need, balance, names, noRoster, setNoRoster, note, setNote, consent, setConsent, onAddPages, onBuy } = p;
  const short = need > balance;
  return (
    <>
      <div className="wizard-review">
        <div className="sum-row"><span className="k">Sınav</span><span className="v">{title || 'Adsız sınav'}</span></div>
        <div className="sum-row"><span className="k">Tür</span><span className="v">{klasik ? 'Klasik' : 'Çoktan seçmeli'}</span></div>
        <div className="sum-row"><span className="k">Cevap anahtarı</span><span className="v">{keyCount ? `${keyCount} fotoğraf` : 'yazılı metin'}</span></div>
        <div className="sum-row"><span className="k">Öğrenci kâğıdı</span><span className="v">{need} sayfa</span></div>
        <div className="sum-row"><span className="k">Sınıf listesi</span><span className={`v${names.length ? '' : ' missing'}`}>{names.length ? `${names.length} öğrenci` : 'yok'}</span></div>
      </div>
      {names.length > 0 && need < names.length && (
        <p className="console-banner warn">Listede {names.length} öğrenci var, {need} sayfa eklendi. Bilerek mi? Değilse <button type="button" className="console-link" onClick={onAddPages}>kâğıt ekleyin</button>.</p>
      )}
      {!names.length && <RosterMissing api={api} onSave={onSaveRoster} noRoster={noRoster} setNoRoster={setNoRoster} />}
      {klasik && (
        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="teacher-note">Okuma ve puanlama için notunuz <span className="muted">(isteğe bağlı)</span></label>
          <textarea id="teacher-note" className="console-text" maxLength={MAX_TEACHER_NOTE} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={'Örnekler:\n• Cevaplar kâğıdın arkasında devam edebilir.\n• 3. soruda birimi yazmayana puan kırmayın.\n• Bu sınavda yazım hatalarını önemsemeyin.'} />
          <span className="field-hint">Yapay zekâ kâğıtları okurken ve puanlarken bu notu dikkate alır.</span>
        </div>
      )}
      <label className="console-check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span><Link href="/kvkk" target="_blank">Aydınlatma metnini</Link> okudum; fotoğrafların okuma için işlenmesini onaylıyorum.</span>
      </label>
      {short && (
        <>
          <p className="console-banner warn" style={{ marginTop: 18 }}>
            Bu sınav için {need} sayfa hakkı gerekiyor, hesabınızda {balance} var. Bir paket seçin; ödemeden sonra bu sayfaya dönersiniz ve sınavı gönderirsiniz.
          </p>
          <div style={{ marginTop: 16 }}>
            <PackageOptions onSelect={onBuy} minimumPages={need - balance} />
          </div>
        </>
      )}
    </>
  );
}

// A new account confirms its e-mail before the first exam: results and
// receipts go to that address.
export function VerifyFirst({ api, email, onVerified }: { api: ReturnType<typeof createApi>; email: string; onVerified: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function resend() {
    setBusy(true);
    const r = await api.resendVerification();
    setBusy(false);
    toast(r.ok ? 'Doğrulama bağlantısı yeniden gönderildi.' : r.error, r.ok ? 'success' : 'error');
  }
  return (
      <div className="wizard-gate">
        <p>
          <strong>{email}</strong> adresine bir doğrulama bağlantısı gönderdik. Sonuçlar ve makbuzlar bu adrese gelir. Bağlantıyı açtıktan sonra bu sayfaya dönüp devam edin.
        </p>
        <div className="wizard-gate-actions">
          <button type="button" className="btn btn-primary" onClick={onVerified}>Doğruladım, devam edin</button>
          <button type="button" className="btn btn-ghost" onClick={resend} disabled={busy}>{busy ? 'Gönderiliyor…' : 'Bağlantıyı yeniden gönderin'}</button>
        </div>
      </div>
  );
}

export function BackIcon() {
  return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
  );
}
