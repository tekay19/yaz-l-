import { describe, expect, it } from 'vitest';
import { mathSegments, plainMath } from '@/lib/klasik/math';

const tex = (s: string) => mathSegments(s).map((x) => x.tex ?? `[${x.text}]`).join('');

describe('mathematics on screen', () => {
  it('shows roots and fractions as they look on paper', () => {
    expect(tex('1/(sqrt(5)-sqrt(2)) * (sqrt(5)+sqrt(2))/(sqrt(5)+sqrt(2)) - sqrt(2)/2')).toBe(
      '\\frac{1}{\\sqrt{5}-\\sqrt{2}}\\cdot \\frac{\\sqrt{5}+\\sqrt{2}}{\\sqrt{5}+\\sqrt{2}}-\\frac{\\sqrt{2}}{2}');
    expect(tex('= (3 - √10 + 2) / (3(√5 - √2))')).toBe('=\\frac{3-\\sqrt{10}+2}{3\\left(\\sqrt{5}-\\sqrt{2}\\right)}');
    expect(tex('1/√3 = √3/3')).toBe('\\frac{1}{\\sqrt{3}}=\\frac{\\sqrt{3}}{3}');
  });

  it('reads every way the reader writes a cube root, and keeps a caret power as written', () => {
    expect(tex('³√80 = 2³√10')).toBe('\\sqrt[3]{80}=2\\sqrt[3]{10}');
    expect(tex('cbrt(80) = 2*cbrt(10)')).toBe('\\sqrt[3]{80}=2\\cdot \\sqrt[3]{10}');
    expect(tex('6∛10 / 2 = 3∛10')).toBe('\\frac{6\\sqrt[3]{10}}{2}=3\\sqrt[3]{10}');
    expect(tex('2(2^3√10 + ^3√10)')).toBe('2\\left({2}^{3}\\sqrt{10}+{}^{3}\\sqrt{10}\\right)');
    expect(tex('cuberoot(80) = 2*cuberoot(10)')).toBe('\\sqrt[3]{80}=2\\cdot \\sqrt[3]{10}');
  });

  it('keeps decimal commas, powers and arrows right', () => {
    expect(tex('0,06 * 10^8 = 6 * 10^6 -> K = 5006')).toBe('0{,}06\\cdot {10}^{8}=6\\cdot {10}^{6}\\rightarrow K=5006');
    expect(tex('10^-6 + x² = 2x^(n+1)')).toBe('{10}^{-6}+{x}^{2}=2{x}^{n+1}');
    expect(tex('20x = 2x^2 + 50 ⇒ (x – 5)^2 = 0')).toBe('20x=2{x}^{2}+50\\Rightarrow {\\left(x-5\\right)}^{2}=0');
  });

  it('leaves sentences and plain equations exactly as written', () => {
    for (const s of ['Lirik şiir duyguyu anlatır.', 'x = 3 ve y = 5', 'Mondros Ateşkes anlaşması imzalanarak kabul edilmiştir.', '%50 indirim']) {
      expect(mathSegments(s)).toEqual([{ text: s }]);
    }
  });

  it('typesets only the mathematics inside a sentence', () => {
    expect(mathSegments('Ortalaması (29 + 35)/2 = 64/2 = 32 olur.')).toEqual([
      { text: 'Ortalaması ' },
      { text: '(29 + 35)/2 = 64/2 = 32', tex: '\\frac{29+35}{2}=\\frac{64}{2}=32' },
      { text: ' olur.' },
    ]);
    expect(tex('bölge: 6cbrt(30) / 3 = 2cbrt(30), 4cbrt(5) / 2')).toBe('[bölge: ]\\frac{6\\sqrt[3]{30}}{3}=2\\sqrt[3]{30},\\,\\frac{4\\sqrt[3]{5}}{2}');
  });

  it('keeps the reader\'s doubt marks, and falls back to readable text when it cannot parse', () => {
    expect(tex('6[?] * 10^6')).toBe('6\\text{[?]}\\cdot {10}^{6}');
    expect(tex('0,5 * 10^[?8] = 5000 * 10^6')).toBe('0{,}5\\cdot {10}^{\\text{[?8]}}=5000\\cdot {10}^{6}');
    expect(tex("x = [?Kut'ul amare]")).toBe("[x = [?Kut'ul amare]]");
    expect(tex('0,06 * 10^8 = 6 * 10^6 (virgülü 2 basamak kaydırdım)')).toBe('0{,}06\\cdot {10}^{8}=6\\cdot {10}^{6}[ (virgülü 2 basamak kaydırdım)]');
    expect(mathSegments('(29 + 35/2')).toEqual([{ text: '(' }, { text: '29 + 35/2', tex: '29+\\frac{35}{2}' }]); // the bracket never closes
    expect(mathSegments('sqrt(5 * 2')).toEqual([{ text: '√(' }, { text: '5 * 2', tex: '5\\cdot 2' }]);
    expect(plainMath('x >= 2 -> sqrt(x)')).toBe('x ≥ 2 → √(x)');
  });

  it('never lets the text carry its own LaTeX', () => {
    for (const seg of mathSegments('\\href{javascript:alert(1)}{x} 1/2 $\\frac{a}{b}$')) {
      if (seg.tex) expect(seg.tex).not.toMatch(/href|javascript|\$/);
    }
  });
});
