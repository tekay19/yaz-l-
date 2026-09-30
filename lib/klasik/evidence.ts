// A verdict counts only if the words it quotes are really in the student's
// answer: the model cannot give credit for what is not on the paper.
//
// Matching forgives what a faithful quote may still differ in (case, spacing,
// quote marks, the transcription's uncertainty markers, a word or two in a
// long quote) and nothing else. A paraphrase is not a quote.

const UNCERTAIN = /\[\?([^\]]*)\]/g; // [?kalem] → kalem, [?] → ''
const QUOTE_MARKS = /["'“”‘’`«»]/g;
const EDGE_PUNCT = /^[.,;:!?()]+|[.,;:!?()]+$/g;

export const MIN_WORD_MATCH = 0.85;

export function normalizeText(s: string): string {
  return s.toLocaleLowerCase('tr').replace(UNCERTAIN, '$1').replace(QUOTE_MARKS, '').replace(/\s+/g, ' ').trim();
}

const squash = (s: string) => normalizeText(s).replace(/\s+/g, '');
const words = (s: string) => normalizeText(s).split(' ').map((w) => w.replace(EDGE_PUNCT, '')).filter(Boolean);

export function quoteFound(quote: string, text: string): boolean {
  const q = squash(quote);
  if (!q) return false;
  if (squash(text).includes(q)) return true;
  const qw = words(quote);
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
