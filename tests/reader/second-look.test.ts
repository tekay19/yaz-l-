import { describe, expect, it, vi } from 'vitest';
import { secondLook, unsure } from '@/lib/reader';
import { OutputTruncated, type Reader } from '@/lib/reader/types';
import { usage } from '../helpers/reader';
import type { KlasikRead } from '@/lib/types';

const ln = (...t: string[]) => t.map((text) => ({ text, crossed: false }));
const page = (over: Partial<KlasikRead> = {}): KlasikRead => ({
  isBackSide: false, studentName: 'Elif Yıldız', nameConfidence: 'high', unreadable: false,
  answers: [{ q: 1, lines: ln('2. Balkan'), unclear: false, hasFigure: false }], ...over,
});
const unclear = page({ answers: [{ q: 1, lines: ln("[?Kut'ul amare]"), unclear: true, hasFigure: false }] });
const reads = (read: KlasikRead) => vi.fn<Reader['readKlasik']>(async () => ({ read, usage }));

describe('a second look by the stronger model', () => {
  it('is worth it for an unclear answer, an unsure name or an unreadable page, not for a back page without a name', () => {
    expect(unsure(page())).toBe(false);
    expect(unsure(unclear)).toBe(true);
    expect(unsure(page({ nameConfidence: 'low' }))).toBe(true);
    expect(unsure(page({ unreadable: true, answers: [] }))).toBe(true);
    expect(unsure(page({ isBackSide: true, studentName: null, nameConfidence: 'low' }))).toBe(false);
  });

  it('reads again only the pages the first reader was unsure of, and keeps the stronger reading', async () => {
    const expert = reads(page());
    const sure = await secondLook(reads(page()), expert)(Buffer.from('jpg'));
    expect(expert).not.toHaveBeenCalled();
    expect(sure.usage).toEqual(usage);
    const looked = await secondLook(reads(unclear), expert)(Buffer.from('jpg'), 'not');
    expect(expert).toHaveBeenCalledWith(Buffer.from('jpg'), 'not');
    expect(looked.read.answers[0]).toMatchObject({ lines: ln('2. Balkan'), unclear: false });
    expect(looked.usage).toEqual({ inputTokens: 20, outputTokens: 10 }); // both readings are paid for
  });

  it('keeps the first reading when the second look fails, and stands in when the first reader fails', async () => {
    const broken = vi.fn<Reader['readKlasik']>(async () => { throw new Error('overloaded'); });
    expect((await secondLook(reads(unclear), broken)(Buffer.from('jpg'))).read).toEqual(unclear);
    expect((await secondLook(broken, reads(page()))(Buffer.from('jpg'))).read).toEqual(page());
    const cut = vi.fn<Reader['readKlasik']>(async () => { throw new OutputTruncated('max_tokens'); });
    await expect(secondLook(cut, reads(page()))(Buffer.from('jpg'))).rejects.toBeInstanceOf(OutputTruncated);
  });

  it('never asks again once a second call would outlive the queue lease', async () => {
    let now = 1_000_000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const slow = vi.fn<Reader['readKlasik']>(async () => { now += 200_000; return { read: unclear, usage }; });
    const expert = reads(page());
    try {
      expect((await secondLook(slow, expert)(Buffer.from('jpg'))).read).toEqual(unclear);
      expect(expert).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });
});
