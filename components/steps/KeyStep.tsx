'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import WizardShell from '../WizardShell';
import Thumb from '../Thumb';
import { useToast } from '../Toast';
import { patchUpload, readUpload, type ExamMode } from '@/lib/useUpload';
import { ACCEPT, validate } from './uploads';

const MODES: Record<ExamMode, { label: string; title: string; hint: string }> = {
  optik: {
    label: 'Çoktan seçmeli',
    title: 'Doğru şıkları işaretlediğiniz optik formu yükleyin',
    hint: 'Tek fotoğraf yeterli',
  },
  klasik: {
    label: 'Klasik (yazılı)',
    title: 'Cevapları yazdığınız anahtar kâğıdını yükleyin',
    hint: 'Kendi el yazınız da olur',
  },
};

export default function KeyStep() {
  const router = useRouter();
  const toast = useToast();
  const stored = typeof window === 'undefined' ? null : readUpload();

  const [mode, setMode] = useState<ExamMode>(stored?.mode ?? 'optik');
  const [file, setFile] = useState<File | null>(null);
  const [savedName, setSavedName] = useState<string | null>(stored?.key ?? null);
  const [receipt, setReceipt] = useState<string | null>(stored?.receipt ?? null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const copy = MODES[mode];
  const picked = Boolean(file || savedName);

  async function accept(list: FileList | File[] | null) {
    const incoming = Array.from(list || []).slice(0, 1);
    if (!incoming.length) return;

    setBusy(true);
    try {
      const result = await validate(incoming);
      if (!result.ok.length) {
        toast(result.reason || 'Cevap anahtarı okunamadı.');
        return;
      }
      setFile(result.ok[0]);
      setSavedName(result.ok[0].name);
      if (result.receipt) setReceipt(result.receipt);
    } finally {
      setBusy(false);
    }
  }

  function onNext() {
    if (!savedName || !receipt) {
      toast('Devam etmek için cevap anahtarını yükleyin.');
      return;
    }
    if (!patchUpload({ mode, key: savedName, receipt })) {
      toast('Tarayıcınız oturum depolamasına izin vermiyor.');
      return;
    }
    router.push('/kagitlar');
  }

  return (
    <WizardShell
      step={2}
      title="Cevap anahtarınızı yükleyin"
      lead="Öğrenci kâğıtları bu anahtarla karşılaştırılıp puanlanır."
      back={{ href: '/paket', label: 'Pakete dönün' }}
      nextLabel="Devam edin"
      nextDisabled={busy}
      onNext={onNext}
    >
      <div className="field-block">
        <span className="field-block-label">Sınav türü</span>
        <div className="mode-tabs" role="tablist" aria-label="Sınav türü">
          {(Object.keys(MODES) as ExamMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              className="mode-tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
            >
              {MODES[m].label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`drop${picked ? ' filled' : ''}${dragging ? ' over' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void accept(e.dataTransfer?.files ?? null);
        }}
      >
        {picked ? (
          <div className="drop-filled">
            <Thumb
              file={file ?? undefined}
              name={savedName ?? undefined}
              onRemove={() => {
                setFile(null);
                setSavedName(null);
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}>
              Değiştirin
            </button>
          </div>
        ) : (
          <>
            <p className="drop-title">{copy.title}</p>
            <p className="small muted">{copy.hint}</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              {busy ? 'Kontrol ediliyor…' : 'Fotoğraf seçin'}
            </button>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            void accept(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <p className="tiny muted" style={{ marginTop: 14 }}>
        JPG, PNG, WEBP ve HEIC · dosya başına en fazla 8 MB. Fotoğraf kontrol edilip bırakılır,
        hiçbir yere kaydedilmez.
      </p>
    </WizardShell>
  );
}
