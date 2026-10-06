// A verdict counts only if the words it quotes are really in the student's
// answer: the model cannot give credit for what is not on the paper.
//
// Matching forgives what a faithful quote may still differ in (case, spacing,
// quote marks, the transcription's uncertainty markers, a word or two in a
// long quote) and nothing else. A paraphrase is not a quote.

const UNCERTAIN = /\[\?([^\]]*)\]/g; // [?kalem] → kalem, [?] → ''
const COMBINING_DOT = /̇/g; // U+0307, left over from a decomposed İ
const QUOTE_MARKS = /["'“”‘’`«»]/g;
const EDGE_PUNCT = /^[.,;:!?()]+|[.,;:!?()]+$/g;

export const MIN_WORD_MATCH = 0.85;

// Lower-cased for matching only. A capital I written without its dot reads as
// ı under Turkish rules ("ISTANBUL" → "ıstanbul"), so ı and i are one letter
// here; a decomposed İ (I + U+0307) is folded the same way.
export function normalizeText(s: string): string {
  return s.normalize('NFC').toLocaleLowerCase('tr').replace(COMBINING_DOT, '').replace(/ı/g, 'i')
    .replace(UNCERTAIN, '$1').replace(QUOTE_MARKS, '').replace(/\s+/g, ' ').trim();
}

const squash = (s: string) => normalizeText(s).replace(/\s+/g, '');
const words = (s: string) => normalizeText(s).split(' ').map((w) => w.replace(EDGE_PUNCT, '')).filter(Boolean);
const DIGIT = /\d/;

// A quoted number must be the whole number on the paper: "x = 2" is not in
// "x = 25", and "4" is not in "14" or in "4,5". A word may still be the start
// of a longer one ("kloroplast" in "kloroplastta"). Spacing is ignored for the
// match but kept for the boundary, so two lines ("= 11", "2x = 8") never
// fuse into one number.
function containsQuote(text: string, q: string): boolean {
  const t = normalizeText(text);
  const at: number[] = []; // position in t of each squashed character
  let flat = '';
  for (let i = 0; i < t.length; i++) if (t[i] !== ' ') { flat += t[i]; at.push(i); }
  for (let k = flat.indexOf(q); k >= 0; k = flat.indexOf(q, k + 1)) {
    const before = t[at[k] - 1] ?? '';
    const after = t.slice(at[k + q.length - 1] + 1, at[k + q.length - 1] + 3);
    const startsOk = !DIGIT.test(q[0]) || !DIGIT.test(before);
    const endsOk = !DIGIT.test(q[q.length - 1]) || !(DIGIT.test(after[0] ?? '') || /^[.,]\d/.test(after));
    if (startsOk && endsOk) return true;
  }
  return false;
}

// The grading prompt numbers the student's lines ("1. …", "2. …"); a model
// may copy those numbers into a quote. They are not the student's writing.
const LINE_NO = /(^|\n)\s*\d+\.\s+/g;

export function quoteFound(quote: string, text: string): boolean {
  // models like to end a quote with a period the student never wrote
  const q = squash(normalizeText(quote.replace(LINE_NO, '$1')).replace(EDGE_PUNCT, ''));
  if (!q) return false;
  if (containsQuote(text, q)) return true;
  const qw = words(quote.replace(LINE_NO, '$1'));
  if (qw.length < 4) return false; // short quotes must match exactly
  const tw = words(text);
  let from = 0;
  let hits = 0;
  for (const w of qw) {
    const at = tw.indexOf(w, from);
    if (at >= 0) {
      hits++;
      from = at + 1;
    }
  }
  return hits / qw.length >= MIN_WORD_MATCH;
}
