import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/client/download';

describe('toCsv', () => {
  it('quotes every cell and doubles inner quotes', () => {
    expect(toCsv([['a', 1, null], ['say "hi"']])).toBe('"a","1",""\n"say ""hi"""');
  });
  it('defuses visitor text that Excel would run as a formula', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '-2', '@a', 'ok']])).toBe(`"'=HYPERLINK(""x"")","'+1","'-2","'@a","ok"`);
    expect(toCsv([[-2]])).toBe('"-2"'); // numbers are ours, not visitor text
  });
});
