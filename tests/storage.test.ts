import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createDiskStorage } from '@/lib/storage';

describe('disk storage', () => {
  it('writes, reads and removes; remove of a missing file is fine', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'so-'));
    const s = createDiskStorage(root);
    await s.write('jobs/abc/1.jpg', Buffer.from('hi'));
    expect((await s.read('jobs/abc/1.jpg')).toString()).toBe('hi');
    await s.remove('jobs/abc/1.jpg');
    await s.remove('jobs/abc/1.jpg');
    await expect(s.read('jobs/abc/1.jpg')).rejects.toThrow();
  });
  it('refuses keys that could escape the root', async () => {
    const s = createDiskStorage(os.tmpdir());
    await expect(s.write('../etc/passwd.jpg', Buffer.from('x'))).rejects.toThrow('invalid_key');
  });
});
