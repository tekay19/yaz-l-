'use client';

// What the teacher picked on the upload step, carried through to the summary
// and order screens.
//
// Only file names, counts and the server's opaque validation receipt are kept
// in sessionStorage. Image bytes are never stored there.

import { useCallback, useEffect, useState } from 'react';

const STORE_KEY = 'sinavoku_upload';
const ORDER_KEY = 'sinavoku_order';

export type ExamMode = 'optik' | 'klasik';

export type Upload = {
  mode: ExamMode;
  key: string | null;
  count: number;
  names: string[];
  receipt: string | null;
  ts: number;
};

export const EMPTY_UPLOAD: Upload = { mode: 'optik', key: null, count: 0, names: [], receipt: null, ts: 0 };

export function hasRequiredUpload(upload: Upload): boolean {
  return Boolean(
    upload.key?.trim() &&
    Number.isInteger(upload.count) &&
    upload.count > 0 &&
    upload.count <= 500 &&
    upload.names.length === upload.count &&
    upload.receipt &&
    /^[0-9a-f-]{36}$/i.test(upload.receipt),
  );
}

export function readUpload(): Upload {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY_UPLOAD;
    const parsed = JSON.parse(raw) as Partial<Upload>;
    return {
      mode: parsed.mode === 'klasik' ? 'klasik' : 'optik',
      key: typeof parsed.key === 'string' ? parsed.key : null,
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      names: Array.isArray(parsed.names) ? parsed.names.filter((n) => typeof n === 'string') : [],
      receipt: typeof parsed.receipt === 'string' ? parsed.receipt : null,
      ts: typeof parsed.ts === 'number' ? parsed.ts : 0,
    };
  } catch {
    return EMPTY_UPLOAD;
  }
}

export function writeUpload(data: Upload) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge one step's result into the stored record. The wizard is a page per
 * step now, so each screen saves only its own fields and leaves the rest of
 * the record alone.
 */
export function patchUpload(patch: Partial<Upload>): Upload | null {
  const next = { ...readUpload(), ...patch, ts: Date.now() };
  return writeUpload(next) ? next : null;
}

/** The answer key step is done. */
export const hasKey = (u: Upload) => Boolean(u.key?.trim() && u.receipt);

/** The student papers step is done. */
export const hasPapers = (u: Upload) =>
  Boolean(Number.isInteger(u.count) && u.count > 0 && u.names.length === u.count);

export function orderNo(): string {
  try {
    let id = sessionStorage.getItem(ORDER_KEY);
    if (!id) {
      id =
        'SO-' +
        Math.random().toString(36).slice(2, 7).toUpperCase() +
        '-' +
        new Date().getFullYear();
      sessionStorage.setItem(ORDER_KEY, id);
    }
    return id;
  } catch {
    return 'SO------';
  }
}

/** Read-only view of the stored upload, for the summary and order screens. */
export function useUpload(): { upload: Upload; order: string; ready: boolean } {
  const [upload, setUpload] = useState<Upload>(EMPTY_UPLOAD);
  const [order, setOrder] = useState('—');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUpload(readUpload());
    setOrder(orderNo());
    setReady(true);
  }, []);

  return { upload, order, ready };
}

export function useOrderNo(): string {
  const [order, setOrder] = useState('—');
  const refresh = useCallback(() => setOrder(orderNo()), []);
  useEffect(refresh, [refresh]);
  return order;
}
