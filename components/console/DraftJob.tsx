'use client';

import { useRef, useState } from 'react';
import type { Api, JobView } from './api';

type Upload = {
  key: string; name: string; kind: 'key' | 'student';
  state: 'up' | 'ok' | 'err'; pageId?: string; seq?: number; error?: string;
};
type Note = { ok: boolean; text: string } | null;

type Props = { api: Api; job: JobView; onChanged: () => void; onSubmitted: () => void };

export default function DraftJob({ api, job, onChanged, onSubmitted }: Props) {
  const next = useRef(0);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [roster, setRoster] = useState('');
  const [rosterNote, setRosterNote] = useState<Note>(null);
  const [consent, setConsent] = useState(false);
  // shown once the server says no roster was saved: going without one is a choice
  const [askNoRoster, setAskNoRoster] = useState(false);
  const [noRoster, setNoRoster] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitNote, setSubmitNote] = useState<Note>(null);

  const patch = (key: string, change: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...change } : u)));

  async function upload(files: FileList | null, kind: 'key' | 'student') {
    if (!files?.length) return;
    // one request per photo, in order: the backend numbers pages as they arrive,
    // and a back side must come right after its front
    for (const file of Array.from(files)) {
      const key = String(++next.current);
      setUploads((list) => [...list, { key, name: file.name, kind, state: 'up' }]);
      const r = await api.uploadPage(job.id, file, kind);
      if (!r.ok) {
        patch(key, { state: 'err', error: r.error });
        continue;
      }
      // a new key page replaces the old one on the server
      if (kind === 'key') setUploads((list) => list.filter((u) => u.kind !== 'key' || u.key === key));
      patch(key, { state: 'ok', pageId: r.data.id, seq: r.data.seq });
    }
    onChanged();
  }

  async function remove(u: Upload) {
    if (!u.pageId) return;
    const r = await api.removePage(job.id, u.pageId);
    if (!r.ok) {
      patch(u.key, { state: 'err', error: r.error });
      return;
    }
    setUploads((list) => list.filter((x) => x.key !== u.key));
    onChanged();
  }

  async function saveRoster() {
    const r = await api.setRoster(job.id, roster);
    setRosterNote(r.ok ? { ok: true, text: `${r.data.count} isim kaydedildi.` } : { ok: false, text: r.error });
  }

  async function submit() {
    setBusy(true);
    setSubmitNote(null);
    const r = await api.submit(job.id, noRoster);
    setBusy(false);
    if (r.ok) {
      setSubmitNote({ ok: true, text: `Gönderildi; ${r.data.reserved} sayfa hakkı ayrıldı.` });
      onSubmitted();
      return;
    }
    if (r.body?.error === 'no_roster') setAskNoRoster(true);
    const extra = r.status === 402 && r.body ? ` (gereken ${r.body.need}, mevcut ${r.body.have})` : '';
    setSubmitNote({ ok: false, text: r.error + extra });
  }

  return (
    <div>
      <h3 className="console-sub">1. Sınıf listesi</h3>
      <p className="tiny muted">
        Her satıra bir öğrenci. Kâğıttaki isimler bu listeyle eşleştirilir. Liste girmezseniz göndermeden önce bunu ayrıca onaylamanız istenir.
      </p>
      <textarea className="console-text" value={roster} onChange={(e) => setRoster(e.target.value)} placeholder={'Elif Yılmaz\nMert Kaya'} />
      <div className="console-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={saveRoster}>Listeyi kaydet</button>
        {rosterNote && <span className={`small ${rosterNote.ok ? 'muted' : 'console-err'}`}>{rosterNote.text}</span>}
      </div>

      <h3 className="console-sub">2. Fotoğraflar</h3>
      <div className="console-row">
        <label className="btn btn-ghost btn-sm">
          Cevap anahtarı seç
          <input type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files, 'key'); e.target.value = ''; }} />
        </label>
        <label className="btn btn-ghost btn-sm">
          Öğrenci kâğıtları seç
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files, 'student'); e.target.value = ''; }} />
        </label>
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        Arkalı önlü kâğıtta önce ön yüzü, hemen ardından arka yüzü yükleyin. Yeni anahtar eskisinin yerine geçer. Sayfa yenilenirse bu liste boşalır; sayılar yukarıda sunucudan gelir.
      </p>
      {uploads.length > 0 && (
        <div className="console-files">
          {uploads.map((u) => (
            <div key={u.key} className={`console-file${u.state === 'err' ? ' err' : ''}`}>
              <span>{u.kind === 'key' ? 'Anahtar' : 'Öğrenci'} · {u.name}</span>
              <span>
                {u.state === 'up' && 'yükleniyor…'}
                {u.state === 'err' && u.error}
                {u.state === 'ok' && (
                  <>
                    sayfa {u.seq}{' '}
                    <button type="button" className="console-link" onClick={() => remove(u)}>sil</button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <h3 className="console-sub">3. Gönder</h3>
      <label className="console-check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Aydınlatma metnini okudum; fotoğrafların okuma için işlenmesini onaylıyorum.
      </label>
      {askNoRoster && (
        <label className="console-check">
          <input type="checkbox" checked={noRoster} onChange={(e) => setNoRoster(e.target.checked)} />
          Sınıf listesi olmadan devam et: isimler yalnız fotoğraftan okunur, bir listeyle karşılaştırılmaz.
        </label>
      )}
      <div className="console-row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!consent || busy || (askNoRoster && !noRoster)} onClick={submit}>Sınavı gönder</button>
      </div>
      {submitNote && <p className={`console-banner ${submitNote.ok ? 'ok' : 'err'}`}>{submitNote.text}</p>}
    </div>
  );
}
