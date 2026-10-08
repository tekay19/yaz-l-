import { describe, expect, it, vi } from 'vitest';
import { crossReadKlasik, reconcile, sameReading } from '@/lib/reader/cross';
import { roles } from '@/lib/reader';
import { fakeReader, usage } from '../helpers/reader';
import type { KlasikRead } from '@/lib/types';

const ln = (...t: string[]) => t.map((text) => ({ text, crossed: false }));
const page = (answers: KlasikRead['answers'], name: string | null = 'Elif Yıldız'): KlasikRead =>
  ({ isBackSide: false, studentName: name, nameConfidence: 'high', unreadable: false, answers });
const a = (q: number, ...t: string[]) => ({ q, lines: ln(...t), unclear: false, hasFigure: false });

describe('cross-reading', () => {
  it('treats spacing, case and punctuation as the same reading, but never a different number', () => {
    expect(sameReading('3x = 16 + 5', '3x=16+5')).toBe(true);
    expect(sameReading('Buharlaşma: su ısınır.', 'buharlaşma su ısınır')).toBe(true);
    expect(sameReading('x = 25', 'x = 2,5')).toBe(false);
    expect(sameReading('36 + 64 = 110', '36 + 64 = 100')).toBe(false);
    expect(sameReading('Mitokondri', 'Mitekondri')).toBe(true); // one letter in ten: same for grading
    expect(sameReading('Mitokondri', 'Ribozom')).toBe(false);
  });

  it('marks the answers the readers disagree on and keeps the second reading', () => {
    const r = reconcile(
      page([a(1, '3x = 21', 'x = 7'), a(2, '240 * 25 / 100 = 50'), a(3, 'c = 10 cm')]),
      page([a(1, '3x=21', 'x=7'), a(2, '240 * 25 / 100 = 60'), a(4, 'Mitokondri')]),
    );
    expect(r.answers.map((x) => [x.q, x.unclear, x.altText ?? null])).toEqual([
      [1, false, null],
      [2, true, '240 * 25 / 100 = 60'],
      [3, true, ''], // the second reader did not see it
      [4, true, ''], // only the second reader saw it
    ]);
  });

  it('lowers the name confidence when the readers read different names', () => {
    expect(reconcile(page([], 'Elif Yıldız'), page([], 'Elif Yılmaz')).nameConfidence).toBe('low');
    expect(reconcile(page([], 'Elif Yıldız'), page([], 'elif yıldız')).nameConfidence).toBe('high');
  });

  it('reads with both at once and lets one stand in when the other fails', async () => {
    const first = fakeReader({ readKlasik: async () => ({ read: page([a(1, 'x = 7')]), usage }) });
    const second = fakeReader({ readKlasik: async () => ({ read: page([a(1, 'x = 1')]), usage }) });
    const both = await crossReadKlasik(first, second)(Buffer.from('jpg'));
    expect(both.read.answers[0]).toMatchObject({ unclear: true, altText: 'x = 1' });
    expect(both.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
    const broken = fakeReader({ readKlasik: async () => { throw new Error('quota'); } });
    expect((await crossReadKlasik(first, broken)(Buffer.from('jpg'))).read.answers[0].unclear).toBe(false);
    expect((await crossReadKlasik(broken, second)(Buffer.from('jpg'))).read.answers[0].lines[0].text).toBe('x = 1');
  });
});

describe('model roles', () => {
  it('runs everything on one model by default, as before', () => {
    expect(roles({ GRADER_PROVIDER: 'openai', GRADER_MODEL: 'gpt-x' })).toEqual({
      reader: { provider: 'openai', model: 'gpt-x' }, grader: { provider: 'openai', model: 'gpt-x' }, cross: null, escalate: null,
    });
  });
  it('reads and grades with Haiku and escalates to Sonnet by default, the measured best', () => {
    const r = roles({});
    expect(r.grader).toEqual({ provider: 'anthropic', model: 'claude-haiku-5-5' });
    expect(r.escalate).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5-5' });
    expect(roles({ ESCALATE_PROVIDER: 'none' }).escalate).toBeNull();
    expect(roles({ ESCALATE_MODEL: 'claude-opus-5-5' }).escalate).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' });
    // a strong grader has nothing to escalate to by default; one can still be named
    expect(roles({ GRADER_MODEL: 'claude-opus-5-5' }).escalate).toBeNull();
    expect(roles({ GRADER_MODEL: 'claude-opus-5-5', ESCALATE_PROVIDER: 'anthropic', ESCALATE_MODEL: 'claude-fable-5-1' }).escalate)
      .toEqual({ provider: 'anthropic', model: 'claude-fable-5-1' });
  });
  it('splits reading, grading and the second reading', () => {
    const r = roles({ READER_PROVIDER: 'gemini', GRADER_PROVIDER: 'openai', GRADER_MODEL: 'gpt-x', CROSS_READ_PROVIDER: 'openai' });
    expect(r.reader).toEqual({ provider: 'gemini', model: 'gemini-3.8-flash' }); // never the grader's model on another vendor
    expect(r.grader).toEqual({ provider: 'openai', model: 'gpt-x' });
    expect(r.cross).toEqual({ provider: 'openai', model: 'gpt-5.6-terra' });
  });
});

describe('the spare provider', () => {
  it('stands in for a call that failed fast, never for a late one or a cut-off answer', async () => {
    const { fallback } = await import('@/lib/reader');
    const { OutputTruncated } = await import('@/lib/reader/types');
    const spare = vi.fn(async () => 'spare');
    expect(await fallback(async () => { throw new Error('503'); }, spare, 'x')()).toBe('spare');

    let now = 1_000_000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const slow = fallback(async () => { now += 200_000; throw new Error('timeout'); }, spare, 'x');
    await expect(slow()).rejects.toThrow('timeout');
    clock.mockRestore();

    await expect(fallback(async () => { throw new OutputTruncated('max_tokens'); }, spare, 'x')()).rejects.toBeInstanceOf(OutputTruncated);
    expect(spare).toHaveBeenCalledTimes(1);
  });
});
