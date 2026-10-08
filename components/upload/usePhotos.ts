'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Api, Draft } from '@/components/console/api';
import { useToast } from '@/components/Toast';
import { MAX_KEY_PAGES } from '@/lib/limits';
import { PER_PICK_KEY, PER_PICK_STUDENT } from './PhotoDrop';

export type Kind = 'key' | 'student';
// a photo on its way up, or one the server refused (kept on screen with the reason)
export type Pending = { key: string; kind: Kind; name: string; url: string; error?: string };

// The photos of a draft: each picked photo is uploaded at once, in order (a
// back side right after its front), and checked by the server; an accepted
// one joins the draft's pages, a refused one stays on screen with the reason
// until the teacher takes it away.
export function usePhotos(api: Api, draft: Draft | null, setDraft: Dispatch<SetStateAction<Draft | null>>) {
  const toast = useToast();
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);

  async function add(files: File[], kind: Kind) {
    if (!draft || uploading) return;
    const klasik = draft.mode === 'klasik';
    const single = kind === 'key' && !klasik;
    const keys = draft.pages.filter((p) => p.kind === 'key').length;
    const limit = Math.min(single ? 1 : kind === 'key' ? PER_PICK_KEY : PER_PICK_STUDENT, kind === 'key' && klasik ? MAX_KEY_PAGES - keys : Infinity);
    const picked = files.slice(0, limit);
    if (files.length > limit) {
      toast(single
        ? 'Çoktan seçmeli sınavın anahtarı tek sayfadır; ilk fotoğraf alındı.'
        : `Her seferde en fazla ${limit} fotoğraf: ilk ${limit} tanesi alındı, kalanları sonra ekleyin.`);
    }
    const items: Pending[] = picked.map((file, i) => ({
      key: `${Date.now()}-${i}`, kind, name: file.name || 'fotoğraf', url: URL.createObjectURL(file),
    }));
    setPending((list) => [...list.filter((p) => p.error), ...items]);
    setUploading(true);
    let refused = 0;
    for (const [i, item] of items.entries()) {
      const r = await api.uploadPage(draft.id, picked[i], kind);
      if (r.ok) {
        URL.revokeObjectURL(item.url);
        setPending((list) => list.filter((p) => p.key !== item.key));
        setDraft((d) => d && {
          ...d,
          // an optik key is replaced on the server: the old one goes
          pages: [...d.pages.filter((p) => !(single && p.kind === 'key')), { id: r.data.id, kind, seq: r.data.seq }],
        });
      } else {
        refused++;
        setPending((list) => list.map((p) => (p.key === item.key ? { ...p, error: r.error } : p)));
      }
    }
    setUploading(false);
    if (refused) toast(`${refused} fotoğraf kabul edilmedi; nedeni fotoğrafın altında. Yeniden çekip ekleyin.`, 'error');
  }

  function dismiss(item: Pending) {
    URL.revokeObjectURL(item.url);
    setPending((list) => list.filter((p) => p.key !== item.key));
  }

  async function remove(pageId: string) {
    if (!draft) return;
    const r = await api.removePage(draft.id, pageId);
    if (!r.ok) { toast(r.error, 'error'); return; }
    setDraft((d) => d && { ...d, pages: d.pages.filter((p) => p.id !== pageId) });
  }

  return { pending, uploading, add, dismiss, remove };
}
