'use client';

// The teacher's way in: four screens from an empty exam to a submitted one.
// Everything lives on the server as a draft from the first screen on — each
// photo is uploaded and checked the moment it is picked — so a reload, the
// e-mailed sign-in link or the payment page never loses work: the wizard
// reopens at /yukle?sinav=<id> and reads the draft back.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createApi, type Draft, type Me } from '@/components/console/api';
import LoginForm from '@/components/console/LoginForm';
import PackageOptions from '@/components/PackageOptions';
import { StepHeader, SiteFooter } from '@/components/Chrome';
import { useToast } from '@/components/Toast';
import { rememberReturn } from '@/lib/client/resume';
import { usePlan } from '@/lib/usePlan';
import type { PackName } from '@/lib/packs';
import { MAX_KEY_PAGES, MAX_TEACHER_NOTE } from '@/lib/limits';
import PhotoDrop, { PER_PICK } from './PhotoDrop';
import PhotoGrid, { PhotoTips } from './PhotoGrid';
import { usePhotos } from './usePhotos';

type Step = 1 | 2 | 3 | 4;

const TITLES: Record<Step, string> = {
  1: 'Sınavınızı tanımlayın',
  2: 'Cevap anahtarını ekleyin',
  3: 'Öğrenci kâğıtlarını ekleyin',
  4: 'Kontrol edin ve gönderin',
};

const parseRoster = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

export default function UploadWizard() {
  const api = useMemo(() => createApi(), []);
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [plan, choosePlan] = usePlan();

  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<'optik' | 'klasik'>('optik');
  const [title, setTitle] = useState('');
  const [roster, setRoster] = useState('');
  const [keyText, setKeyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [noRoster, setNoRoster] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const photos = usePhotos(api, draft, setDraft);
  const uploading = photos.uploading;
  const jobId = params.get('sinav');
  const paid = params.get('odeme');

  const loadMe = useCallback(async () => {
    const r = await api.me();
    setMe(r.ok ? r.data : null);
  }, [api]);

  const loadDraft = useCallback(async (id: string) => {
    const r = await api.draft(id);
    if (!r.ok) {
      setError(r.status === 404 ? 'Bu sınav bulunamadı.' : r.error);
      return null;
    }
    if (r.data.status !== 'draft') {
      // already submitted: its progress is followed under the account
      router.replace(`/hesap?sinav=${r.data.id}`);
      return null;
    }
    setDraft(r.data);
    setMode(r.data.mode);
    setTitle(r.data.title);
    setRoster(r.data.roster.join('\n'));
    setKeyText(r.data.keyText);
    setNote(r.data.teacherNote);
    return r.data;
  }, [api, router]);

  useEffect(() => { loadMe(); }, [loadMe]);

  useEffect(() => {
    if (!me || !jobId || draft?.id === jobId) return;
    loadDraft(jobId).then((d) => {
      if (!d) return;
      const asked = Number(params.get('adim'));
      setStep(asked >= 1 && asked <= 4 ? (asked as Step) : 2);
    });
  }, [me, jobId, draft?.id, loadDraft, params]);

  useEffect(() => {
    if (paid === 'ok') toast('Ödeme alındı; sayfa hakkınız eklendi.');
    if (paid === 'hata') toast('Ödeme tamamlanamadı; sayfa hakkı eklenmedi.');
  }, [paid, toast]);

  const keyPages = draft?.pages.filter((p) => p.kind === 'key') ?? [];
  const studentPages = draft?.pages.filter((p) => p.kind === 'student') ?? [];
  const names = parseRoster(roster);
  const klasik = mode === 'klasik';
  const hasKey = keyPages.length > 0 || (klasik && keyText.trim().length > 0);
  const balance = me?.pageBalance ?? 0;
  const need = studentPages.length;

  function go(next: Step) {
    setError(null);
    setStep(next);
    if (draft) router.replace(`/yukle?sinav=${draft.id}&adim=${next}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- step 1: the exam ------------------------------------------------
  async function saveExam() {
    setBusy(true);
    setError(null);
    const typed = roster; // loading the new draft below resets the field
    let d = draft;
    if (!d) {
      const r = await api.createJob(title.trim(), klasik ? 'klasik' : 'optik');
      if (!r.ok) { setBusy(false); setError(r.error); return; }
      router.replace(`/yukle?sinav=${r.data.id}&adim=2`, { scroll: false });
      d = await loadDraft(r.data.id);
    }
    if (d && typed.trim() !== d.roster.join('\n')) {
      const r = await api.setRoster(d.id, typed);
      setRoster(typed);
      if (!r.ok) { setBusy(false); setError(r.error); return; }
      setDraft({ ...d, roster: parseRoster(typed) });
    }
    setBusy(false);
    if (d) go(2);
  }

  // ---- step 2: the typed key ----------------------------------------------
  async function saveKey() {
    if (!draft) return;
    if (klasik && keyText.trim() !== draft.keyText.trim()) {
      setBusy(true);
      const r = await api.setKeyText(draft.id, keyText);
      setBusy(false);
      if (!r.ok) { setError(r.error); return; }
      setDraft({ ...draft, keyText });
    }
    if (!keyPages.length && !(klasik && keyText.trim())) {
      setError(klasik ? 'Anahtarın fotoğrafını ekleyin ya da metnini yazın.' : 'Cevap anahtarının fotoğrafını ekleyin.');
      return;
    }
    go(3);
  }

  // ---- step 4: submit or pay ----------------------------------------------
  async function submit() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    if (klasik && note.trim() !== draft.teacherNote) {
      const n = await api.setNote(draft.id, note);
      if (!n.ok) { setBusy(false); setError(n.error); return; }
    }
    const r = await api.submit(draft.id, !names.length && noRoster);
    setBusy(false);
    if (r.ok) {
      setSent(r.data.reserved);
      loadMe();
      return;
    }
    if (r.body?.error === 'insufficient') loadMe();
    setError(r.error);
  }

  async function buy(name: PackName) {
    if (!draft) return;
    choosePlan(name);
    setBusy(true);
    setError(null);
    const r = await api.checkout(name);
    if (!r.ok) { setBusy(false); setError(r.error); return; }
    rememberReturn(`/yukle?sinav=${draft.id}&adim=4`);
    window.location.href = r.data.paymentPageUrl;
  }

  // ---- screens ------------------------------------------------------------
  const grid = (kind: 'key' | 'student') => draft && (
    <PhotoGrid jobId={draft.id} kind={kind} pages={draft.pages} pending={photos.pending} onRemove={photos.remove} onDismiss={photos.dismiss} />
  );

  let body: React.ReactNode;
  if (me === undefined) {
    body = <p className="empty">Yükleniyor…</p>;
  } else if (me === null) {
    body = (
      <>
        <p className="small" style={{ marginBottom: 14 }}>
          Kâğıtlarınız hesabınıza kaydedilir. E-postanıza gelen bağlantıyla giriş yapın; bu sayfaya kaldığınız yerden dönersiniz.
        </p>
        <div onSubmitCapture={() => rememberReturn(jobId ? `/yukle?sinav=${jobId}&adim=${step}` : '/yukle')}>
          <LoginForm api={api} linkFailed={false} />
        </div>
      </>
    );
  } else if (sent !== null && draft) {
    body = (
      <div className="card" style={{ padding: 24 }}>
        <h2>Sınavınız gönderildi</h2>
        <p className="small" style={{ marginTop: 10 }}>
          {sent} sayfa hakkı ayrıldı. Kâğıtlar şimdi okunuyor.
          {klasik ? ' Önce cevap anahtarınızdan puanlama ölçütleri hazırlanır ve onayınıza sunulur.' : ' Bitince size e-posta gelir.'}
          {' '}Okunamayan sayfaların hakkı iade edilir.
        </p>
        <Link href={`/hesap?sinav=${draft.id}`} className="btn btn-primary" style={{ marginTop: 18 }}>Sınavı takip edin</Link>
      </div>
    );
  } else if (step === 1) {
    body = (
      <>
        {me.klasik && (
          <div className="field-block">
            <p className="field-block-label">Sınav türü</p>
            <div className="seg" role="group" aria-label="Sınav türü">
              {(['optik', 'klasik'] as const).map((m) => (
                <button key={m} type="button" className={mode === m ? 'on' : undefined} disabled={Boolean(draft)} onClick={() => setMode(m)}>
                  {m === 'optik' ? 'Çoktan seçmeli' : 'Klasik (açık uçlu)'}
                </button>
              ))}
            </div>
            {draft && <p className="tiny muted" style={{ marginTop: 6 }}>Sınav oluşturuldu; türü değiştirmek için yeni sınav başlatın.</p>}
          </div>
        )}
        <div className="field">
          <label htmlFor="exam-title">Sınavın adı</label>
          <input id="exam-title" value={title} disabled={Boolean(draft)} onChange={(e) => setTitle(e.target.value)} placeholder="9-B Matematik 1. yazılı" />
        </div>
        <div className="field">
          <label htmlFor="exam-roster">Sınıf listesi <span className="muted">(önerilir)</span></label>
          <textarea id="exam-roster" className="console-text" value={roster} onChange={(e) => setRoster(e.target.value)}
            placeholder={'Her satıra bir öğrenci\nElif Yılmaz\nMert Kaya'} />
          <span className="field-hint">Kâğıttaki isimler bu listeyle eşleştirilir; birkaç sayfalık sınavda sayfalar isimden aynı öğrencide toplanır. e-Okul&apos;dan kopyalayıp yapıştırabilirsiniz.</span>
        </div>
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <PhotoDrop
          title={klasik ? 'Cevap anahtarınızın fotoğrafları' : 'Cevap anahtarının fotoğrafı'}
          hint={klasik ? 'Birden fazla sayfa olabilir; sırayla ekleyin.' : 'Doğru şıkların işaretli olduğu tek sayfa. Yenisi eskisinin yerine geçer.'}
          busy={uploading}
          single={!klasik}
          full={klasik && keyPages.length >= MAX_KEY_PAGES}
          onPick={(f) => photos.add(f, 'key')}
        />
        {grid('key')}
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
  } else if (step === 3) {
    const missing = names.length > 0 && need < names.length;
    body = (
      <>
        <PhotoDrop
          title="Öğrenci kâğıtları"
          hint={`Her seferde en fazla ${PER_PICK} fotoğraf. Bir öğrencinin sayfalarını sırayla ekleyin (ön yüz, arka yüz, sonraki sayfalar). Sayfalarda isim yazıyorsa sıra karışsa da isimden toplanır.`}
          busy={uploading}
          onPick={(f) => photos.add(f, 'student')}
        />
        <PhotoTips />
        {grid('student')}
        {missing && (
          <p className="console-banner warn">
            Sınıf listesinde {names.length} öğrenci var, {need} sayfa eklendi. Eksik kâğıt varsa şimdi ekleyin.
          </p>
        )}
      </>
    );
  } else {
    const short = need > balance;
    body = (
      <>
        <div className="card review-list">
          <div className="sum-row"><span className="k">Sınav</span><span className="v">{draft?.title || 'Adsız sınav'} · {klasik ? 'Klasik' : 'Çoktan seçmeli'}</span></div>
          <div className="sum-row"><span className="k">Cevap anahtarı</span><span className="v">{keyPages.length ? `${keyPages.length} fotoğraf` : 'yazılı metin'}</span></div>
          <div className="sum-row"><span className="k">Öğrenci kâğıdı</span><span className="v">{need} sayfa</span></div>
          <div className="sum-row"><span className="k">Sınıf listesi</span><span className={`v${names.length ? '' : ' missing'}`}>{names.length ? `${names.length} öğrenci` : 'yok'}</span></div>
        </div>
        {names.length > 0 && need < names.length && (
          <p className="console-banner warn">Listede {names.length} öğrenci var, {need} sayfa eklendi. Bilerek mi? Değilse <button type="button" className="console-link" onClick={() => go(3)}>kâğıt ekleyin</button>.</p>
        )}
        {!names.length && (
          <label className="console-check">
            <input type="checkbox" checked={noRoster} onChange={(e) => setNoRoster(e.target.checked)} />
            Sınıf listesi olmadan devam et: isimler yalnız fotoğraftan okunur, bir listeyle karşılaştırılmaz.
          </label>
        )}
        {klasik && (
          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="teacher-note">Okuma ve puanlama için notunuz <span className="muted">(isteğe bağlı)</span></label>
            <textarea id="teacher-note" className="console-text" maxLength={MAX_TEACHER_NOTE} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={'Örnekler:\n• Cevaplar kâğıdın arkasında devam edebilir.\n• 3. soruda birimi yazmayana puan kırmayın.\n• Bu sınavda yazım hatalarını önemsemeyin.'} />
            <span className="field-hint">Yapay zekâ kâğıtları okurken ve puanlarken bu notu dikkate alır. Puanlar yine onayladığınız ölçütlerle hesaplanır.</span>
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
              <PackageOptions selected={plan.name} onSelect={buy} minimumPages={need - balance} />
            </div>
          </>
        )}
      </>
    );
  }

  // the main button for each step, in the sidebar
  const signedIn = Boolean(me);
  const next: { label: string; run: () => void; disabled: boolean } | null =
    !signedIn || sent !== null ? null
      : step === 1 ? { label: draft ? 'Devam edin' : 'Sınavı oluşturun', run: saveExam, disabled: busy || (klasik && !me?.klasik) }
        : step === 2 ? { label: 'Devam edin', run: saveKey, disabled: busy || uploading }
          : step === 3 ? { label: need ? `${need} sayfayla devam edin` : 'Devam edin', run: () => (need ? go(4) : setError('En az bir öğrenci kâğıdı ekleyin.')), disabled: uploading }
            : need > balance ? null
              : { label: 'Sınavı gönderin', run: submit, disabled: busy || !consent || (!names.length && !noRoster) };

  const stepper = (Math.min(step, 4) as Step);
  return (
    <>
      <StepHeader current={stepper} />
      <main className="wizard">
        <div className="wrap">
          <p className="wizard-count">Adım {stepper} / 4</p>
          <h1>{signedIn ? TITLES[stepper] : 'Önce giriş yapın'}</h1>
          <div className="wizard-grid">
            <div className="wizard-body">
              {body}
              {error && <p className="console-banner err">{error}</p>}
            </div>
            <aside className="card summary wizard-aside">
              <h2>Sınavınız</h2>
              <div className="sum-row"><span className="k">Tür</span><span className="v">{klasik ? 'Klasik' : 'Çoktan seçmeli'}</span></div>
              <div className="sum-row"><span className="k">Cevap anahtarı</span><span className={`v${hasKey ? '' : ' missing'}`}>{hasKey ? 'Eklendi' : 'Bekliyor'}</span></div>
              <div className="sum-row"><span className="k">Öğrenci sayfası</span><span className={`v${need ? '' : ' missing'}`}>{need || 'Bekliyor'}</span></div>
              <div className="sum-row"><span className="k">Sayfa hakkınız</span><span className="v">{signedIn ? balance : '—'}</span></div>
              {next && (
                <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 22 }} onClick={next.run} disabled={next.disabled}>
                  {next.label}
                </button>
              )}
              <p className="tiny muted" style={{ marginTop: 12 }}>
                Okunamayan sayfaların hakkı iade edilir. Kâğıt fotoğrafları 7 gün içinde (kontrolünüzü bekleyen sınavda 14 gün) silinir.
              </p>
            </aside>
          </div>
          <p className="wizard-back">
            {step > 1 && signedIn && sent === null
              ? <button type="button" className="back-link console-link" onClick={() => go((step - 1) as Step)}>← Önceki adım</button>
              : <Link href={signedIn ? '/hesap' : '/'} className="back-link">← {signedIn ? 'Hesabınıza dönün' : 'Ana sayfaya dönün'}</Link>}
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
