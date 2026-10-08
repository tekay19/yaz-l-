'use client';

// Mathematics in a reading as it looks on paper (lib/klasik/math.ts): the
// parts that need it typeset with KaTeX — roots, powers, fractions — and the
// rest exactly as written.

import { Fragment, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { mathSegments, plainMath } from '@/lib/klasik/math';

function Tex({ tex, text }: { tex: string; text: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: true, strict: 'ignore' });
    } catch {
      return null;
    }
  }, [tex]);
  // KaTeX escapes what it is given, and the LaTeX is built only from the
  // digits, letters and known signs of the reading (lib/klasik/math.ts)
  return html ? <span className="math" title={text} dangerouslySetInnerHTML={{ __html: html }} /> : <>{plainMath(text)}</>;
}

export default function MathText({ text }: { text: string }) {
  const segments = useMemo(() => mathSegments(text), [text]);
  return <>{segments.map((s, i) => (s.tex ? <Tex key={i} tex={s.tex} text={s.text} /> : <Fragment key={i}>{s.text}</Fragment>))}</>;
}

// Under a field the teacher types into: how its mathematics will read.
export function MathPreview({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => mathSegments(l).some((s) => s.tex));
  if (!lines.length) return null;
  return (
    <div className="math-preview">
      <span className="tiny muted">Görünüşü:</span>
      {lines.map((l, i) => <div key={i}><MathText text={l} /></div>)}
    </div>
  );
}
