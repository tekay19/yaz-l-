import type { Storage } from '@/lib/storage';

export function memoryStorage(): Storage & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    write: async (k, d) => { files.set(k, d); },
    read: async (k) => { const f = files.get(k); if (!f) throw new Error('missing'); return f; },
    remove: async (k) => { files.delete(k); },
  };
}
