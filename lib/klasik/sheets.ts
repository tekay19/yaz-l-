import type { KlasikAnswer, KlasikGrade, KlasikRead, PageOverride, PageResult } from '@/lib/types';

// The page columns sheet building needs (a subset of a `pages` row).
export type SheetPage = {
  id: string; seq: number; status: string; error: string | null; filePath: string | null;
  result: PageResult | null; override: PageOverride | null;
  grade: KlasikGrade | null; gradedRev: number; gradeAttempts: number;
};

// One student's paper: the front page and the back sides photographed right
// after it. Grades, grading bookkeeping and the teacher's fixes live on the
// front page (`pageId`).
export type Sheet = {
  pageId: string; pageIds: string[]; seqs: number[]; filePaths: string[];
  read: KlasikRead; override: PageOverride;
  grade: KlasikGrade | null; gradedRev: number; gradeAttempts: number;
};

export const answerText = (a: KlasikAnswer | undefined) =>
  (a ? a.lines.filter((l) => !l.crossed).map((l) => l.text).join('\n') : '');

const copy = (a: KlasikAnswer): KlasikAnswer => ({ ...a, lines: a.lines.map((l) => ({ ...l })) });

// Pages become sheets the way optik does it: a back side belongs to the page
// photographed just before it. A klasik answer can run over the page break,
// so a back side's lines for a question already on the front are appended to
// it rather than dropped. A back side after an unreadable page stays on its
// own, rather than joining an earlier, unrelated student.
export function mergeSheets(rows: SheetPage[]): { sheets: Sheet[]; failed: SheetPage[] } {
  const sheets: Sheet[] = [];
  const failed: SheetPage[] = [];
  let joinable = false;
  for (const p of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (p.status === 'uploaded') continue;
    if (p.status !== 'read' || p.result?.type !== 'klasik-student') {
      failed.push(p);
      joinable = false;
      continue;
    }
    const read = p.result.read;
    const last = sheets[sheets.length - 1];
    if (read.isBackSide && joinable && last) {
      last.pageIds.push(p.id);
      last.seqs.push(p.seq);
      if (p.filePath) last.filePaths.push(p.filePath);
      last.read = { ...last.read, answers: mergeAnswers(last.read.answers, read.answers) };
      continue;
    }
    sheets.push({
      pageId: p.id, pageIds: [p.id], seqs: [p.seq], filePaths: p.filePath ? [p.filePath] : [],
      read: { ...read, answers: read.answers.map(copy).sort((a, b) => a.q - b.q) },
      override: p.override ?? {}, grade: p.grade, gradedRev: p.gradedRev, gradeAttempts: p.gradeAttempts,
    });
    joinable = true;
  }
  // the teacher's fixes of the transcription win over what was read
  for (const s of sheets) s.read = { ...s.read, answers: applyTexts(s.read.answers, s.override.texts ?? []) };
  return { sheets, failed };
}

function mergeAnswers(front: KlasikAnswer[], back: KlasikAnswer[]): KlasikAnswer[] {
  const out = front.map(copy);
  for (const b of back) {
    const f = out.find((a) => a.q === b.q);
    if (f) {
      f.lines.push(...b.lines.map((l) => ({ ...l })));
      f.unclear ||= b.unclear;
      f.hasFigure ||= b.hasFigure;
    } else out.push(copy(b));
  }
  return out.sort((a, b) => a.q - b.q);
}

function applyTexts(answers: KlasikAnswer[], texts: { q: number; text: string }[]): KlasikAnswer[] {
  const out = answers.map(copy);
  for (const t of texts) {
    const lines = t.text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).map((text) => ({ text, crossed: false }));
    const i = out.findIndex((a) => a.q === t.q);
    const fixed: KlasikAnswer = { q: t.q, lines, unclear: false, hasFigure: i >= 0 ? out[i].hasFigure : false };
    if (i >= 0) out[i] = fixed;
    else out.push(fixed);
  }
  return out.sort((a, b) => a.q - b.q);
}
