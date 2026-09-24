import { describe, expect, it } from 'vitest';
import { matchRoster, normalizeName } from '@/lib/grading/names';

describe('names', () => {
  it('normalizes Turkish letters, case and spacing', () => {
    expect(normalizeName('  ŞİMŞEK   Çağla ')).toBe('simsek cagla');
    expect(normalizeName('IŞIL Öztürk')).toBe('isil ozturk');
  });
  it('matches small handwriting slips and rejects strangers', () => {
    const roster = ['Elif Yılmaz', 'Mert Kaya', 'Zeynep Demir'];
    expect(matchRoster('Elif Yilmaz', roster)).toBe('Elif Yılmaz');
    expect(matchRoster('Zeynep Demr', roster)).toBe('Zeynep Demir');
    expect(matchRoster('Ahmet Şahin', roster)).toBeNull();
    expect(matchRoster(null, roster)).toBeNull();
  });
});
