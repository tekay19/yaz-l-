// The reader writes mathematics as plain text (sqrt(5), x^2, a/b, *), and
// sometimes with symbols (√5, ³√80, ∛10). A teacher should see it as it looks
// on paper: these turn the parts of a line that need it into LaTeX for the
// screen, and leave everything else — Turkish sentences, plain equations —
// exactly as written. The stored text never changes: grading, quotes and the
// teacher's own fixes keep working on it.
//
// Fractions follow how a linear copy of handwriting reads: "/" takes the
// whole juxtaposed run on each side ("2x/3" is 2x over 3) but stops at a
// written operator ("1/(a) * (b)/(c)" is two fractions multiplied).

export type MathSegment = { text: string; tex?: string };

type Tok =
  | { k: 'num' | 'id' | 'word' | 'other' | 'op' | 'open' | 'close' | 'punct' | 'space' | 'doubt'; v: string }
  | { k: 'fn'; v: string }
  | { k: 'root'; v: string; n: number }
  | { k: 'sup'; v: string; digits: string };

const FN = new Set(['sqrt', 'cbrt', 'cuberoot', 'log', 'ln', 'sin', 'cos', 'tan', 'cot']);
const CUBE = new Set(['cbrt', 'cuberoot']);
const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
const GREEK: Record<string, string> = { π: '\\pi', α: '\\alpha', β: '\\beta', γ: '\\gamma', θ: '\\theta', Δ: '\\Delta', λ: '\\lambda', μ: '\\mu', σ: '\\sigma', Σ: '\\Sigma' };
const LETTERS = 'A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛûΑ-Ωα-ω';

const RULES: [RegExp, (m: string) => Tok][] = [
  [/^\s+/, (v) => ({ k: 'space', v })],
  // the reader's own doubt, "[?]" or "[?8]": shown as written, inside the
  // mathematics too when it holds nothing but letters, digits and signs
  [/^\[\?[^\]]*\]/, (v) => ({ k: /^\[\?[\p{L}\p{N} .,+\-−]*\]$/u.test(v) ? 'doubt' : 'other', v })],
  [/^\d+(?:[.,]\d+)?/, (v) => ({ k: 'num', v })],
  [/^(?:<=|>=|!=|=>|->|\+-)/, (v) => ({ k: 'op', v })],
  [new RegExp(`^[${LETTERS}]+`), (v) => ({ k: 'word', v })],
  [/^[√∛∜]/, (v) => ({ k: 'root', v, n: v === '√' ? 2 : v === '∛' ? 3 : 4 })],
  [/^[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/, (v) => ({ k: 'sup', v, digits: [...v].map((c) => SUP[c]).join('') })],
  [/^[+\-−–*·⋅×÷/=<>≤≥≠±^→⇒]/, (v) => ({ k: 'op', v })],
  [/^[([]/, (v) => ({ k: 'open', v })],
  [/^[)\]]/, (v) => ({ k: 'close', v })],
  [/^[,;:]/, (v) => ({ k: 'punct', v })],
  [/^[\s\S]/, (v) => ({ k: 'other', v })],
];

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  let rest = text;
  while (rest) {
    for (const [re, make] of RULES) {
      const m = rest.match(re);
      if (!m) continue;
      out.push(make(m[0]));
      rest = rest.slice(m[0].length);
      break;
    }
  }
  // a run of letters is mathematics when it is a function, one letter, a
  // capital name (AB, ABC) or Greek, or stuck to a number or a power ("2xy",
  // "xy^2"); otherwise it is a word of a sentence
  return out.map((t, i) => {
    if (t.k !== 'word') return t;
    const next = out[i + 1];
    if (FN.has(t.v) && next?.k === 'open' && next.v === '(') return { k: 'fn', v: t.v };
    const stuck = [out[i - 1], next].some((x) => x && (x.k === 'num' || x.k === 'sup' || (x.k === 'op' && x.v === '^')));
    const greek = /^[Α-Ωα-ω]+$/.test(t.v);
    return t.v.length === 1 || greek || (/^[A-ZÇĞİÖŞÜ]+$/.test(t.v) && t.v.length <= 4) || stuck ? { k: 'id', v: t.v } : t;
  });
}

const isMath = (t: Tok) => t.k !== 'word' && t.k !== 'other' && t.k !== 'space' && t.k !== 'punct';
const MARKER = (t: Tok) => t.k === 'root' || t.k === 'sup' || (t.k === 'fn' && (t.v === 'sqrt' || CUBE.has(t.v))) || (t.k === 'op' && ['^', '/', '*'].includes(t.v));

const OP_TEX: Record<string, string> = {
  '+': '+', '-': '-', '−': '-', '–': '-', '±': '\\pm ', '+-': '\\pm ',
  '*': '\\cdot ', '·': '\\cdot ', '⋅': '\\cdot ', '×': '\\times ', '÷': '\\div ',
  '=': '=', '<': '<', '>': '>', '<=': '\\le ', '≤': '\\le ', '>=': '\\ge ', '≥': '\\ge ', '!=': '\\ne ', '≠': '\\ne ',
  '->': '\\rightarrow ', '→': '\\rightarrow ', '=>': '\\Rightarrow ', '⇒': '\\Rightarrow ',
  ',': ',\\,', ';': ';\\,', ':': ':',
};
const ADD = new Set(['+', '-', '−', '–', '±', '+-']);
const MUL = new Set(['*', '·', '⋅', '×', '÷']);
const REL = new Set(['=', '<', '>', '<=', '≤', '>=', '≥', '!=', '≠', '->', '→', '=>', '⇒']);

type Part = { tex: string; inner?: string }; // inner: a bracketed group without its brackets
type MTok = Tok & { sp: boolean };

class Parser {
  private i = 0;
  constructor(private t: MTok[]) {}
  private peek() { return this.t[this.i]; }
  private is(k: Tok['k'], set?: Set<string>) { const x = this.peek(); return Boolean(x && x.k === k && (!set || set.has(x.v))); }
  private fail(): never { throw new Error('math_parse'); }

  all(): string {
    const tex = this.seq();
    if (this.i < this.t.length) this.fail();
    return tex;
  }

  // relations and separators; a line may start or end on one ("= √5/3")
  private seq(): string {
    let out = '';
    for (;;) {
      if (this.is('op', REL) || this.is('punct') || this.is('op', MUL)) out += OP_TEX[this.t[this.i++].v];
      if (!this.peek() || this.is('close')) return out;
      out += this.add();
      if (!this.peek() || this.is('close')) return out;
      if (!this.is('op', REL) && !this.is('punct')) this.fail();
    }
  }

  private add(): string {
    let out = '';
    while (this.is('op', ADD)) out += OP_TEX[this.t[this.i++].v];
    out += this.mul();
    while (this.is('op', ADD)) {
      out += OP_TEX[this.t[this.i++].v];
      if (!this.peek() || this.is('close')) return out;
      while (this.is('op', ADD)) out += OP_TEX[this.t[this.i++].v];
      out += this.mul();
    }
    return out;
  }

  private mul(): string {
    let out = this.frac();
    while (this.is('op', MUL)) {
      out += OP_TEX[this.t[this.i++].v];
      if (!this.peek() || this.is('close')) return out;
      while (this.is('op', ADD)) out += OP_TEX[this.t[this.i++].v]; // 2 * -3
      out += this.frac();
    }
    return out;
  }

  private frac(): string {
    let num = this.imp();
    while (this.is('op', new Set(['/']))) {
      this.i++;
      const den = this.imp();
      num = { tex: `\\frac{${num.inner ?? num.tex}}{${den.inner ?? den.tex}}` };
    }
    return num.tex;
  }

  private startsOperand() {
    const x = this.peek();
    return Boolean(x && (x.k === 'num' || x.k === 'id' || x.k === 'fn' || x.k === 'root' || x.k === 'sup' || x.k === 'open' || x.k === 'doubt' || (x.k === 'op' && x.v === '^')));
  }

  // juxtaposition: 2x, 3(√5 - √2), 6∛10
  private imp(): Part {
    const first = this.pow();
    let tex = first.tex;
    let n = 1;
    while (this.startsOperand()) {
      tex += (this.peek().sp ? '\\,' : '') + this.pow().tex;
      n++;
    }
    return n === 1 ? first : { tex };
  }

  private pow(): Part {
    let base = this.atom();
    for (;;) {
      const x = this.peek();
      if (x?.k === 'sup' && this.t[this.i + 1]?.k !== 'root') {
        this.i++;
        base = { tex: `{${base.tex}}^{${x.digits}}` };
      } else if (x?.k === 'op' && x.v === '^') {
        this.i++;
        base = { tex: `{${base.tex}}^{${this.exponent()}}` };
      } else return base;
    }
  }

  private exponent(): string {
    let sign = '';
    while (this.is('op', ADD)) sign += OP_TEX[this.t[this.i++].v];
    const e = this.atom();
    return sign + (e.inner ?? e.tex);
  }

  private group(close: string): Part {
    const inner = this.seq();
    const x = this.peek();
    if (!x || x.k !== 'close' || x.v !== close) this.fail();
    this.i++;
    return { tex: close === ')' ? `\\left(${inner}\\right)` : `\\left[${inner}\\right]`, inner };
  }

  private atom(): Part {
    const x = this.t[this.i++];
    if (!x) this.fail();
    switch (x.k) {
      case 'num': return { tex: x.v.replace(',', '{,}') };
      case 'id': return { tex: [...x.v].map((c) => GREEK[c] ?? c).join(' ') };
      case 'doubt': return { tex: `\\text{${x.v}}` };
      case 'fn': {
        this.i++; // the "(" the tokenizer saw after the name
        const arg = this.group(')');
        if (x.v === 'sqrt') return { tex: `\\sqrt{${arg.inner}}` };
        if (CUBE.has(x.v)) return { tex: `\\sqrt[3]{${arg.inner}}` };
        return { tex: `\\${x.v}${arg.tex}` };
      }
      case 'root': return this.root(x.n);
      case 'sup':
        // ³√80: the index of a root; a power with nothing before it otherwise
        if (this.peek()?.k === 'root') { this.i++; return this.root(Number(x.digits) || 2); }
        return { tex: `{}^{${x.digits}}` };
      case 'op':
        if (x.v === '^') return { tex: `{}^{${this.exponent()}}` }; // "^3√10" written for a cube root
        if (ADD.has(x.v)) return { tex: OP_TEX[x.v] + this.atom().tex };
        return this.fail();
      case 'open': return this.group(x.v === '(' ? ')' : ']');
      default: return this.fail();
    }
  }

  private root(n: number): Part {
    const r = this.peek()?.k === 'open' ? (this.i++, this.group(this.t[this.i - 1].v === '(' ? ')' : ']')) : this.atom();
    const body = r.inner ?? r.tex;
    return { tex: n === 2 ? `\\sqrt{${body}}` : `\\sqrt[${n}]{${body}}` };
  }
}

function toTex(tokens: MTok[]): string | null {
  try {
    return new Parser(tokens).all();
  } catch {
    return null;
  }
}

// Plain text that reads a little better where no LaTeX can be made.
export const plainMath = (s: string) => s
  .replace(/sqrt\(/g, '√(').replace(/(?:cbrt|cuberoot)\(/g, '∛(')
  .replace(/(\S)\s*\*\s*(?=\S)/g, '$1 · ').replace(/->/g, '→').replace(/=>/g, '⇒')
  .replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠').replace(/\+-/g, '±');

// A line split into what stays as written and what is shown as LaTeX.
export function mathSegments(text: string): MathSegment[] {
  const toks = tokenize(text);
  // a separator or a space is part of the mathematics only between two of its pieces
  const math = toks.map((t) => isMath(t));
  const near = (i: number, step: number) => {
    for (let j = i + step; j >= 0 && j < toks.length; j += step) if (toks[j].k !== 'space') return j;
    return -1;
  };
  const between = () => {
    for (const kind of ['punct', 'space']) {
      toks.forEach((t, i) => {
        if (t.k !== kind) return;
        const a = near(i, -1), b = near(i, 1);
        math[i] = a >= 0 && b >= 0 && math[a] && math[b];
      });
    }
  };
  between();
  // a bracket closed outside its stretch of mathematics ("6 * 10^6 (virgülü
  // kaydırdım)") belongs to the sentence
  const open: number[] = [];
  toks.forEach((t, i) => {
    if (!math[i]) { open.length = 0; return; }
    if (t.k === 'open') open.push(i);
    else if (t.k === 'close') {
      const j = open.pop();
      if (j === undefined || (toks[j].v === '(') !== (t.v === ')')) math[i] = false;
    }
    if (i + 1 === toks.length || !math[i + 1]) for (const j of open.splice(0)) math[j] = false;
  });
  between();

  const out: MathSegment[] = [];
  const push = (text: string, tex?: string) => {
    const last = out[out.length - 1];
    if (!tex && last && last.tex === undefined) last.text += text;
    else out.push(tex ? { text, tex } : { text });
  };
  for (let i = 0; i < toks.length;) {
    let j = i;
    while (j < toks.length && math[j] === math[i]) j++;
    const run = toks.slice(i, j);
    const raw = run.map((t) => t.v).join('');
    if (!math[i] || !run.some(MARKER)) push(raw);
    else {
      const mtoks: MTok[] = [];
      let sp = false;
      for (const t of run) {
        if (t.k === 'space') sp = true;
        else { mtoks.push({ ...t, sp }); sp = false; }
      }
      const tex = toTex(mtoks);
      push(tex === null ? plainMath(raw) : raw, tex ?? undefined);
    }
    i = j;
  }
  // a root whose bracket never closes still reads as one
  return out.map((x) => (x.tex ? x : { text: x.text.replace(/sqrt\(/g, '√(').replace(/(?:cbrt|cuberoot)\(/g, '∛(') }));
}
