'use client';

// The teacher's way in: four screens from an empty exam to a submitted one.
// Everything lives on the server as a draft from the first screen on — each
// photo is uploaded and checked the moment it is picked — so a reload, the
// sign-in page or the payment page never loses work: the wizard
// reopens at /yukle?sinav=<id> and reads the draft back.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createApi, type ClassView, type Draft, type Me } from '@/components/console/api';
import { StepHeader, SiteFooter } from '@/components/Chrome';
import { useToast } from '@/components/Toast';
import { rememberReturn } from '@/lib/client/resume';
import { usePlan } from '@/lib/usePlan';
import type { PackName } from '@/lib/packs';
import PhotoGrid from './PhotoGrid';
import { BackIcon, ExamStep, KeyStep, ReviewStep, StudentsStep, VerifyFirst } from './steps';
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
  const [, choosePlan] = usePlan();

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
  const [classes, setClasses] = useState<ClassView[]>([]);
  const [saveAs, setSaveAs] = useState(''); // a class name to keep the typed roster under
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
      router.replace(`/hesap/sinav/${r.data.id}`);
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
    if (me) api.classes().then((r) => r.ok && setClasses(r.data));
  }, [me, api]);

  useEffect(() => {
    if (!me || !jobId || draft?.id === jobId) return;
    loadDraft(jobId).then((d) => {
      if (!d) return;
      const asked = Number(params.get('adim'));
      setStep(asked >= 1 && asked <= 4 ? (asked as Step) : 2);
    });
  }, [me, jobId, draft?.id, loadDraft, params]);

  useEffect(() => {
    if (paid === 'ok') toast('Ödeme alındı; sayfa hakkınız eklendi.', 'success');
    if (paid === 'hata') toast('Ödeme tamamlanamadı; sayfa hakkı eklenmedi.');
    if (paid === 'bekliyor') toast('Ödemeniz kontrol ediliyor; onaylanınca sayfa hakkınız birkaç dakika içinde eklenir.', 'success');
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
    // the balance may have changed since this page opened (a grant, a payment
    // in another tab): the last step must not offer packages on a stale number
    if (next === 4) void loadMe();
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
    if (saveAs.trim() && typed.trim()) {
      const c = await api.createClass(saveAs, typed);
      toast(c.ok ? `${c.data.name} sınıflarınıza kaydedildi` : c.error, c.ok ? 'success' : 'error');
      if (c.ok) setSaveAs('');
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

  // the class list given at the last step, typed or read from a photo
  async function saveRosterText(text: string) {
    if (!draft) return;
    const r = await api.setRoster(draft.id, text);
    if (!r.ok) { setError(r.error); return; }
    setRoster(text);
    setDraft({ ...draft, roster: parseRoster(text) });
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
    const back = () => rememberReturn(jobId ? `/yukle?sinav=${jobId}&adim=${step}` : '/yukle');
    body = (
      <div className="wizard-gate">
        <p>
          Kâğıtlarınız hesabınıza kaydedilir. Giriş yaptıktan ya da hesap açtıktan sonra bu sayfaya kaldığınız yerden dönersiniz.
        </p>
        <div className="wizard-gate-actions">
          <Link href="/giris" className="btn btn-primary" onClick={back}>Giriş yapın</Link>
          <Link href="/kayit" className="btn btn-ghost" onClick={back}>Ücretsiz hesap açın</Link>
        </div>
      </div>
    );
  } else if (!me.verified) {
    body = <VerifyFirst api={api} email={me.email} onVerified={loadMe} />;
  } else if (sent !== null && draft) {
    body = (
      <div className="wizard-sent">
        <p>
          {sent} sayfa hakkı ayrıldı. Kâğıtlar şimdi okunuyor.
          {klasik ? ' Puanlama cevap anahtarınızdan hazırlanır; bitince kontrolünüz için size e-posta gelir.' : ' Bitince size e-posta gelir.'}
          {' '}Okunamayan sayfaların hakkı iade edilir.
        </p>
        <Link href={`/hesap/sinav/${draft.id}`} className="btn btn-primary">Sınavı takip edin</Link>
      </div>
    );
  } else if (step === 1) {
    body = (
      <ExamStep api={api} showMode={me.klasik} mode={mode} setMode={setMode} created={Boolean(draft)} title={title} setTitle={setTitle}
        classes={classes} roster={roster} setRoster={setRoster} saveAs={saveAs} setSaveAs={setSaveAs} />
    );
  } else if (step === 2) {
    body = (
      <KeyStep klasik={klasik} uploading={uploading} keyCount={keyPages.length} onPick={(f) => photos.add(f, 'key')}
        grid={grid('key')} keyText={keyText} setKeyText={setKeyText} />
    );
  } else if (step === 3) {
    body = <StudentsStep uploading={uploading} onPick={(f) => photos.add(f, 'student')} grid={grid('student')} names={names} need={need} />;
  } else {
    body = (
      <ReviewStep api={api} onSaveRoster={saveRosterText} title={draft?.title ?? ''} klasik={klasik} keyCount={keyPages.length} need={need} balance={balance} names={names}
        noRoster={noRoster} setNoRoster={setNoRoster} note={note} setNote={setNote} consent={consent} setConsent={setConsent}
        onAddPages={() => go(3)} onBuy={buy} />
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
  // signed out, unverified or still loading: nothing to summarise or act on yet
  const ready = Boolean(me && me.verified);
  const heading = me === undefined ? TITLES[stepper]
    : me === null ? 'Önce giriş yapın'
      : !me.verified ? 'E-posta adresinizi doğrulayın'
        : sent !== null ? 'Sınavınız gönderildi'
          : TITLES[stepper];
  return (
    <>
      <StepHeader current={stepper} />
      <main className="wizard">
        <div className="wrap">
          {ready && sent === null && <p className="wizard-count">Adım {stepper} / 4</p>}
          <h1>{heading}</h1>
          <div className={`wizard-grid${ready ? '' : ' solo'}`}>
            <div className="wizard-body">
              {body}
              {error && <p className="console-banner err">{error}</p>}
            </div>
            {ready && <aside className="wizard-aside" aria-label="Sınavınızın özeti">
              <h2>Sınavınız</h2>
              <div className="sum-row"><span className="k">Tür</span><span className="v">{klasik ? 'Klasik' : 'Çoktan seçmeli'}</span></div>
              <div className="sum-row"><span className="k">Cevap anahtarı</span><span className={`v${hasKey ? '' : ' missing'}`}>{hasKey ? 'Eklendi' : 'Bekliyor'}</span></div>
              <div className="sum-row"><span className="k">Öğrenci sayfası</span><span className={`v${need ? '' : ' missing'}`}>{need || 'Bekliyor'}</span></div>
              <div className="sum-row"><span className="k">Sayfa hakkınız</span><span className="v">{signedIn ? balance : '—'}</span></div>
              {next && (
                <button type="button" className="btn btn-primary btn-block wizard-next" onClick={next.run} disabled={next.disabled}>
                  {next.label}
                </button>
              )}
              <p className="wizard-aside-note">
                Okunamayan sayfaların hakkı iade edilir. Kâğıt fotoğrafları 7 gün içinde (kontrolünüzü bekleyen sınavda 14 gün) silinir.
              </p>
            </aside>}
          </div>
          <p className="wizard-back">
            {step > 1 && signedIn && sent === null
              ? <button type="button" className="back-link" onClick={() => go((step - 1) as Step)}><BackIcon />Önceki adıma dönün</button>
              : <Link href={signedIn ? '/hesap' : '/'} className="back-link"><BackIcon />{signedIn ? 'Hesabınıza dönün' : 'Ana sayfaya dönün'}</Link>}
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
