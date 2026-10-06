'use client';

// The rubric screen of a klasik exam. The draft comes from the teacher's key;
// the teacher edits it and approves it, and only then is any sheet graded.
// A criterion says what an answer must achieve, never which words it must
// use: that is what lets a different but correct answer earn full marks.

import { useCallback, useEffect, useState } from 'react';
import type { Criterion, QuestionType, Rubric, RubricQuestion, GradingStyle } from '@/lib/types';
import type { Api, RubricView } from './api';
import { NoteBanner } from './ui';

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'islem', label: 'İşlem / çözüm' },
  { value: 'kisa', label: 'Kısa cevap' },
  { value: 'yorum', label: 'Açıklama / yorum' },
];

const total = (q: RubricQuestion) => q.criteria.reduce((s, c) => s + (Number(c.points) || 0), 0);
const nextId = (q: RubricQuestion) => `c${Math.max(0, ...q.criteria.map((c) => Number(c.id.replace(/\D/g, '')) || 0)) + 1}`;

function blankQuestion(n: number): RubricQuestion {
  return {
    q: n, rev: 1, type: 'islem', prompt: null, answer: '',
    criteria: [
      { id: 'c1', text: 'Kurulum', points: 4, role: 'other', required: false },
      { id: 'c2', text: 'Sonuç doğru ve öğrencinin kendi geçerli adımlarından çıkıyor', points: 6, role: 'result', required: false },
    ],
    accepted: [],
    policy: { workRequired: true, carryForward: true, wrongInfoPenalty: false, style: 'balanced' },
  };
}

type Props = { api: Api; jobId: string; onChanged: () => void };

export default function RubricCard({ api, jobId, onChanged }: Props) {
  const [view, setView] = useState<RubricView | null>(null);
  const [rubric, setRubric] = useState<Rubric>({ questions: [] });
  const [keyText, setKeyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api.rubric(jobId);
    if (!r.ok) {
      setNote({ ok: false, text: r.error });
      return;
    }
    setView(r.data);
    setRubric(r.data.rubric ?? { questions: [] });
    setKeyText(r.data.keyText);
  }, [api, jobId]);

  useEffect(() => { load(); }, [load]);

  const setQ = (q: number, change: (x: RubricQuestion) => RubricQuestion) =>
    setRubric((r) => ({ questions: r.questions.map((x) => (x.q === q ? change(x) : x)) }));
  const setC = (q: number, id: string, change: Partial<Criterion>) =>
    setQ(q, (x) => ({ ...x, criteria: x.criteria.map((c) => (c.id === id ? { ...c, ...change } : c)) }));

  async function save(): Promise<boolean> {
    setNote(null);
    const r = await api.saveRubric(jobId, rubric);
    if (!r.ok) {
      setNote({ ok: false, text: r.error });
      return false;
    }
    setRubric(r.data.rubric);
    setNote({ ok: true, text: 'Kaydedildi.' });
    return true;
  }

  async function approve() {
    setBusy(true);
    const saved = await save();
    if (saved) {
      const r = await api.approveRubric(jobId);
      if (r.ok) onChanged();
      else setNote({ ok: false, text: r.error });
    }
    setBusy(false);
  }

  async function saveKey() {
    const r = await api.setKeyText(jobId, keyText);
    setNote(r.ok ? { ok: true, text: 'Anahtar metni kaydedildi.' } : { ok: false, text: r.error });
  }

  async function redraft() {
    if (!window.confirm('Taslak, anahtardan yeniden oluşturulacak; bu ekrandaki düzenlemeleriniz kaybolur. Devam edilsin mi?')) return;
    setBusy(true);
    const saved = await api.setKeyText(jobId, keyText);
    const r = saved.ok ? await api.redraftRubric(jobId) : saved;
    setBusy(false);
    if (r.ok) onChanged();
    else setNote({ ok: false, text: r.error });
  }

  if (!view) return note ? <p className="console-banner err">{note.text}</p> : <p className="empty">Rubrik yükleniyor…</p>;

  const grand = rubric.questions.reduce((s, q) => s + total(q), 0);
  return (
    <div>
      <h3 className="console-sub">Puanlama ölçütleri (rubrik)</h3>
      <p className="small muted">
        Kâğıtlar, siz onayladıktan sonra bu ölçütlere göre puanlanır. Bir ölçüt cevabın neyi başarması gerektiğini söyler,
        hangi kelimeleri kullanacağını değil: farklı ama doğru yollar tam puan alır. Yanlış yoldan bulunan ya da yazılı
        işlemlerden çıkmayan doğru sonuç, sonuç puanı almaz.
      </p>
      {rubric.questions.length > 0 && (
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="grading-style">Puanlama tarzı (bütün sorular)</label>
          <select id="grading-style" value={rubric.questions[0].policy.style ?? 'balanced'}
            onChange={(e) => {
              const style = e.target.value as GradingStyle;
              setRubric((r) => ({ questions: r.questions.map((x) => ({ ...x, policy: { ...x.policy, style } })) }));
            }}>
            <option value="strict">Sıkı: yalnız tam ve doğru ifade edilen fikir puan alır</option>
            <option value="balanced">Dengeli: eksik ama doğru fikir kısmi puan alır</option>
            <option value="lenient">Cömert: konuya uygun, kısmen doğru anlayış gösteren cevap da kısmi puan alır</option>
          </select>
          <p className="tiny muted">Yanlış bilgi, konu dışı yazı ve soruyu tekrar etmek hiçbir tarzda puan getirmez.</p>
        </div>
      )}
      {!rubric.questions.length && (
        <p className="console-banner err">
          Cevap anahtarı okunamadı ya da taslak oluşturulamadı. Anahtarı aşağıya yazıp &quot;Taslağı yeniden oluştur&quot;a basın
          ya da soruları kendiniz ekleyin.
        </p>
      )}

      {rubric.questions.map((q) => (
        <div key={q.q} className="klasik-q">
          <div className="console-row between">
            <strong>{q.q}. soru</strong>
            <span className="small">Toplam {total(q)} puan</span>
          </div>
          <div className="console-row">
            <label className="small">Tür{' '}
              <select className="klasik-select" value={q.type} onChange={(e) => {
                const type = e.target.value as QuestionType;
                setQ(q.q, (x) => ({
                  ...x, type,
                  criteria: type === 'yorum' ? x.criteria.map((c) => ({ ...c, role: 'other' })) : x.criteria,
                  policy: { ...x.policy, workRequired: type === 'islem' ? x.policy.workRequired : false },
                }));
              }}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <button type="button" className="console-link" onClick={() =>
              setRubric((r) => ({ questions: r.questions.filter((x) => x.q !== q.q) }))}>soruyu sil</button>
          </div>
          <label className="small klasik-label">Soru metni (isteğe bağlı)
            <textarea className="console-text klasik-short" value={q.prompt ?? ''} onChange={(e) => setQ(q.q, (x) => ({ ...x, prompt: e.target.value || null }))} />
          </label>
          <label className="small klasik-label">Anahtardaki cevap
            <textarea className="console-text klasik-short" value={q.answer} onChange={(e) => setQ(q.q, (x) => ({ ...x, answer: e.target.value }))} />
          </label>

          <p className="small klasik-label">Ölçütler</p>
          {q.criteria.map((c) => (
            <div key={c.id} className="klasik-crit-edit">
              <input className="klasik-input grow" value={c.text} aria-label="Ölçüt" onChange={(e) => setC(q.q, c.id, { text: e.target.value })} />
              <input className="klasik-input pts" type="number" min={0.5} step={0.5} value={c.points} aria-label="Puan"
                onChange={(e) => setC(q.q, c.id, { points: Number(e.target.value) })} />
              {q.type !== 'yorum' && (
                <label className="small"><input type="checkbox" checked={c.role === 'result'}
                  onChange={(e) => setC(q.q, c.id, { role: e.target.checked ? 'result' : 'other' })} /> Sonuç ölçütü</label>
              )}
              <label className="small"><input type="checkbox" checked={c.required}
                onChange={(e) => setC(q.q, c.id, { required: e.target.checked })} /> Terim şart</label>
              <button type="button" className="console-link" onClick={() =>
                setQ(q.q, (x) => ({ ...x, criteria: x.criteria.filter((y) => y.id !== c.id) }))}>sil</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() =>
            setQ(q.q, (x) => ({ ...x, criteria: [...x.criteria, { id: nextId(x), text: '', points: 1, role: 'other', required: false }] }))}>
            Ölçüt ekle
          </button>

          <p className="small klasik-label">Tam puan alan diğer doğru cevaplar (başka yöntemler, denk gösterimler)</p>
          {q.accepted.map((a, i) => (
            <div key={i} className="klasik-crit-edit">
              <input className="klasik-input grow" value={a.text} aria-label="Kabul edilen cevap"
                onChange={(e) => setQ(q.q, (x) => ({ ...x, accepted: x.accepted.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) }))} />
              {a.example && <span className="tiny muted" title={a.example}>örnek cevap var</span>}
              <button type="button" className="console-link" onClick={() =>
                setQ(q.q, (x) => ({ ...x, accepted: x.accepted.filter((_, j) => j !== i) }))}>sil</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() =>
            setQ(q.q, (x) => ({ ...x, accepted: [...x.accepted, { text: '', example: null, by: 'teacher' }] }))}>
            Doğru cevap ekle
          </button>

          <div className="klasik-policies">
            {q.type === 'islem' && (
              <label className="console-check"><input type="checkbox" checked={q.policy.workRequired}
                onChange={(e) => setQ(q.q, (x) => ({ ...x, policy: { ...x.policy, workRequired: e.target.checked } }))} />
                İşlemler gösterilmeli (işlemsiz yazılan doğru sonuç puan almaz)</label>
            )}
            {q.type === 'islem' && (
              <label className="console-check"><input type="checkbox" checked={q.policy.carryForward}
                onChange={(e) => setQ(q.q, (x) => ({ ...x, policy: { ...x.policy, carryForward: e.target.checked } }))} />
                Hata taşıma: bir işlem hatasından sonraki tutarlı adımlar puan alır</label>
            )}
            <label className="console-check"><input type="checkbox" checked={q.policy.wrongInfoPenalty}
              onChange={(e) => setQ(q.q, (x) => ({ ...x, policy: { ...x.policy, wrongInfoPenalty: e.target.checked } }))} />
              Cevaptaki yanlış ek bilgi puan düşürür</label>
          </div>
        </div>
      ))}

      <div className="console-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() =>
          setRubric((r) => ({ questions: [...r.questions, blankQuestion(Math.max(0, ...r.questions.map((x) => x.q)) + 1)] }))}>
          Soru ekle
        </button>
        <span className="small muted">Sınavın toplamı: {grand} puan</span>
      </div>

      <h3 className="console-sub">Cevap anahtarı metni</h3>
      <p className="tiny muted">Fotoğraftaki anahtar okunamadıysa buraya yazın ya da yapıştırın; taslak buradan yeniden oluşturulabilir.</p>
      <textarea className="console-text" value={keyText} onChange={(e) => setKeyText(e.target.value)} placeholder={'1) 2x + 3 = 11 → 2x = 8 → x = 4\n2) Lirik şiir duygu ve coşkuyu anlatır…'} />
      <div className="console-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={saveKey} disabled={busy}>Anahtarı kaydet</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={redraft} disabled={busy}>Taslağı yeniden oluştur</button>
      </div>

      <NoteBanner note={note} />
      <div className="console-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={save} disabled={busy}>Kaydet</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={approve} disabled={busy || !rubric.questions.length}>
          Onayla ve puanla
        </button>
      </div>
    </div>
  );
}
