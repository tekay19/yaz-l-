'use client';

import { useRef, useState } from 'react';

// Where photos come in: drag and drop, the gallery, or straight from the
// phone's camera. At most PER_PICK at a time, so a teacher adds a few
// sheets, sees each one checked, and adds the next few — a bad photo is
// caught while the sheet is still on the desk.
export const PER_PICK = 4;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

type Props = {
  title: string;
  hint: string;
  busy: boolean;
  full?: boolean;
  single?: boolean;
  onPick: (files: File[]) => void;
};

export default function PhotoDrop({ title, hint, busy, full = false, single = false, onPick }: Props) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const off = busy || full;

  function take(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name));
    if (files.length) onPick(files);
  }

  return (
    <div
      className={`drop${over ? ' over' : ''}`}
      onDragEnter={(e) => { e.preventDefault(); if (!off) setOver(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!off) take(e.dataTransfer?.files ?? null); }}
    >
      <p className="drop-title">{title}</p>
      <p className="small muted">{hint}</p>
      <div className="drop-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={off} onClick={() => camera.current?.click()}>
          Kamerayla çek
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={off} onClick={() => gallery.current?.click()}>
          {single ? 'Fotoğraf seç' : `Fotoğraf seç (en fazla ${PER_PICK})`}
        </button>
      </div>
      {busy && <p className="tiny muted">Fotoğraflar yükleniyor ve kontrol ediliyor…</p>}
      <input ref={gallery} type="file" accept={ACCEPT} multiple={!single} hidden
        onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
