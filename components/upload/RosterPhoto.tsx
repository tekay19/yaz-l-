'use client';

import { useRef, useState } from 'react';
import type { Api } from '@/components/console/api';

// The typed list plus the names read from a photo, each name once; the
// teacher checks them before the list is saved.
export function mergeNames(current: string, names: string[]): string {
  const lines = current.split('\n').map((l) => l.trim()).filter(Boolean);
  const have = new Set(lines.map((l) => l.toLocaleLowerCase('tr')));
  return [...lines, ...names.filter((n) => !have.has(n.toLocaleLowerCase('tr')))].join('\n');
}

// A photo of the class list (an e-Okul printout, a handwritten list) read into
// the roster field.
export default function RosterPhoto({ api, onNames }: { api: Api; onNames: (names: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const r = await api.readRosterPhoto(file);
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      return;
    }
    onNames(r.data.names);
    setMsg({ ok: true, text: `${r.data.names.length} isim okundu. Kontrol edip gerekirse düzeltin, sonra kaydedin.` });
  }

  return (
    <div className="roster-photo">
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Liste okunuyor…' : 'Listeyi fotoğraftan okuyun'}
      </button>
      <input ref={input} type="file" accept="image/*,.heic,.heif" hidden
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {msg && <span className={`small ${msg.ok ? 'muted' : 'console-err'}`} aria-live="polite">{msg.text}</span>}
    </div>
  );
}
