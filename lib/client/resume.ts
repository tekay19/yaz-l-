// Sign-in and payment both leave the site (an e-mailed link, iyzico's page)
// and come back to /hesap. The upload wizard leaves a note of where the
// teacher was, and /hesap sends them back there. Only wizard paths are
// followed, and only for a day: an old note must not hijack a later visit.

const KEY = 'sinavoku:devam';
const TTL_MS = 24 * 60 * 60 * 1000;

export function rememberReturn(path: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* storage blocked: the teacher finds the draft under /hesap instead */
  }
}

export function takeReturn(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    const note = raw ? JSON.parse(raw) : null;
    if (!note || typeof note.path !== 'string' || typeof note.at !== 'number') return null;
    if (now - note.at > TTL_MS || !/^\/yukle(\?|$)/.test(note.path)) return null;
    return note.path;
  } catch {
    return null;
  }
}
