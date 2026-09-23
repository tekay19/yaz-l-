'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import WizardShell from '../WizardShell';
import Thumb from '../Thumb';
import { useToast } from '../Toast';
import { usePlan } from '@/lib/usePlan';
import { hasKey, patchUpload, readUpload } from '@/lib/useUpload';
import { ACCEPT, fileKey, validate } from './uploads';

export default function PapersStep() {
  const router = useRouter();
  const toast = useToast();
  const [plan] = usePlan();

  const [files, setFiles] = useState<File[]>([]);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // the previous step must be done; File objects do not survive navigation,
  // so previously picked papers come back as names only
  useEffect(() => {
    const stored = readUpload();
    if (!hasKey(stored)) {
      router.replace('/yukle');
      return;
    }
    setSavedNames(stored.names);
    setReceipt(stored.receipt);
    setReady(true);
  }, [router]);

  const cap = plan.pages;
  const total = files.length + savedNames.length;

  async function accept(list: FileList | File[] | null) {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;

    setBusy(true);
    try {
      const seen = new Set([...files.map(fileKey), ...savedNames]);
      const fresh = incoming.filter((f) => !seen.has(fileKey(f)) && !seen.has(f.name));
      const duplicates = incoming.length - fresh.length;

      const room = Math.max(0, cap - total);
      const withinCap = fresh.slice(0, room);
      const overflow = fresh.length - withinCap.length;

      const result = await validate(withinCap);
      // only accepted files enter the list — a rejected one is never retried
      if (result.ok.length) setFiles((prev) => prev.concat(result.ok));
      if (result.receipt) setReceipt(result.receipt);

      if (result.rejected) toast(result.reason || `${result.rejected} görsel kabul edilmedi.`);
      if (duplicates) toast(`${duplicates} dosya zaten seçiliydi, atlandı.`);
      if (overflow) toast(`${plan.short} ${cap} sayfa kapsıyor; ${overflow} görsel alınmadı.`);
    } finally {
      setBusy(false);
    }
  }

  function onNext() {
    const names = [...savedNames, ...files.map((f) => f.name)];
    if (!names.length) {
      toast('En az bir öğrenci kâğıdı yükleyin.');
      return;
    }
    if (!receipt) {
      toast('Görseller doğrulanamadı. Fotoğrafları yeniden ekleyin.');
      return;
    }
    if (!patchUpload({ count: names.length, names, receipt })) {
      toast('Tarayıcınız oturum depolamasına izin vermiyor.');
      return;
    }
    router.push('/ozet');
  }

  if (!ready) return null;

  return (
    <WizardShell
      step={3}
      title="Öğrenci kâğıtlarını yükleyin"
      lead={`Sıraya koymanıza gerek yok, hepsini birden seçebilirsiniz. ${plan.short} ${cap} sayfa kapsıyor.`}
      back={{ href: '/yukle', label: 'Cevap anahtarına dönün' }}
      nextLabel={total ? `${total} kâğıtla devam edin` : 'Devam edin'}
      nextDisabled={busy}
      onNext={onNext}
    >
      <div
        className={`drop${total ? ' filled' : ''}${dragging ? ' over' : ''}`}
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
        <p className="drop-title">Kâğıtları masaya dizip çekin</p>
        <p className="small muted">Sürükleyip bırakın ya da hepsini birden seçin</p>
        <button
          type="button"
          className={`btn btn-sm ${total ? 'btn-ghost' : 'btn-primary'}`}
          onClick={() => input.current?.click()}
          disabled={busy || total >= cap}
        >
          {busy ? 'Kontrol ediliyor…' : total ? 'Daha ekleyin' : 'Fotoğrafları seçin'}
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void accept(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {total > 0 && (
        <>
          <p className="thumb-count">
            {total} / {cap} sayfa
          </p>
          <div className="thumb-grid">
            {savedNames.map((name, i) => (
              <Thumb
                key={`saved-${name}-${i}`}
                name={name}
                onRemove={() => setSavedNames((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
            {files.map((f, i) => (
              <Thumb
                key={`${fileKey(f)}-${i}`}
                file={f}
                onRemove={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        </>
      )}

      <p className="tiny muted" style={{ marginTop: 14 }}>
        JPG, PNG, WEBP ve HEIC · dosya başına en fazla 8 MB
      </p>
    </WizardShell>
  );
}
