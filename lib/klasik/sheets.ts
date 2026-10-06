import type { KlasikAnswer, KlasikGrade, KlasikRead, PageOverride, PageResult } from '@/lib/types';
import { normalizeName, rosterName, stripNameLabel } from '@/lib/grading/names';

// The page columns sheet building needs (a subset of a `pages` row).
export type SheetPage = {
  id: string; seq: number; status: string; error: string | null; filePath: string | null;
  result: PageResult | null; override: PageOverride | null;
  grade: KlasikGrade | null; gradedRev: number; gradeAttempts: number;
};

// One student's paper: its first page and every page found to belong to it
// (back sides, later pages). Grades, grading bookkeeping and the teacher's fixes live on the
// front page (`pageId`).
export type Sheet = {
  pageId: string; pageIds: string[]; seqs: number[]; filePaths: string[];
  read: KlasikRead; override: PageOverride;
  grade: KlasikGrade | null; gradedRev: number; gradeAttempts: number;
};

export const answerText = (a: KlasikAnswer | undefined) =>
  (a ? a.lines.filter((l) => !l.crossed).map((l) => l.text).join('\n') : '');

const copy = (a: KlasikAnswer): KlasikAnswer => ({ ...a, lines: a.lines.map((l) => ({ ...l })) });

// Pages become sheets. A student's exam can be several pages, and teachers
// photograph them two ways: student by student, or in stacks (every first
// page, then every second page). An upload that opens with three or more
// first pages in a row is in stacks; student by student, a first page is
// followed by its own next page (two in a row is just a student whose exam
// is one page).
//   - A page with a name joins the sheet of the same student wherever it is
//     (matched to the roster when there is one, also when shortened).
//   - A page without a name, or with a name no sheet has yet, continues a
//     sheet whose questions it carries on (see `continues`): the page just
//     before it when photographed student by student; in stacks, the sheet
//     that is furthest behind. A name only signs a sheet nobody signed, and
//     a page with its own name field (a first page) never joins a sheet that
//     has one: a student's exam has one first page. Left empty, it is
//     another student who forgot to sign.
//   - Anything else starts a sheet of its own, for the teacher to see.
// A klasik answer can run over the page break, so a continuation page's lines
// for a question already on the sheet are appended rather than dropped. A page
// after an unreadable one never joins an earlier, unrelated student.
export function mergeSheets(rows: SheetPage[], roster: string[] = []): { sheets: Sheet[]; failed: SheetPage[] } {
  const sheets: Sheet[] = [];
  const failed: SheetPage[] = [];
  const byName = new Map<string, Sheet>();
  const signed = new Set<Sheet>();
  const fronts = new Set<Sheet>(); // sheets that have a page with a name field
  let last: Sheet | null = null;
  const ordered = [...rows].sort((a, b) => a.seq - b.seq);
  const reads = ordered.flatMap((p) => (p.status === 'read' && p.result?.type === 'klasik-student' ? [p.result.read] : []));
  const leadingFronts = reads.findIndex((read) => read.isBackSide);
  const stacks = (leadingFronts < 0 ? reads.length : leadingFronts) >= 3 && reads.some((read) => read.isBackSide);
  for (const p of ordered) {
    if (p.status === 'uploaded') continue;
    if (p.status !== 'read' || p.result?.type !== 'klasik-student') {
      failed.push(p);
      last = null;
      continue;
    }
    const read = p.result.read;
    const name = nameKey(read.studentName, roster);
    let target: Sheet | undefined = name ? byName.get(name) : undefined;
    if (!target) {
      const fits = (s: Sheet) => continues(s, read) && !(name && signed.has(s)) && (read.isBackSide || !fronts.has(s));
      target = stacks
        ? sheets.filter(fits).sort((a, b) => a.pageIds.length - b.pageIds.length)[0] // stable: the earliest of the furthest behind
        : last && fits(last) ? last : undefined;
    }
    if (target) {
      target.pageIds.push(p.id);
      target.seqs.push(p.seq);
      if (p.filePath) target.filePaths.push(p.filePath);
      target.read = { ...target.read, answers: mergeAnswers(target.read.answers, read.answers) };
      // the clearest signature on any page names the sheet
      if (read.studentName && (!target.read.studentName || (target.read.nameConfidence === 'low' && read.nameConfidence === 'high'))) {
        target.read = { ...target.read, studentName: read.studentName, nameConfidence: read.nameConfidence };
      }
    } else {
      target = {
        pageId: p.id, pageIds: [p.id], seqs: [p.seq], filePaths: p.filePath ? [p.filePath] : [],
        read: { ...read, answers: read.answers.map(copy).sort((a, b) => a.q - b.q) },
        override: p.override ?? {}, grade: p.grade, gradedRev: p.gradedRev, gradeAttempts: p.gradeAttempts,
      };
      sheets.push(target);
    }
    if (name) {
      if (!byName.has(name)) byName.set(name, target);
      signed.add(target);
    }
    if (!read.isBackSide) fronts.add(target);
    last = target;
  }
  // the teacher's fixes of the transcription win over what was read
  for (const s of sheets) s.read = { ...s.read, answers: applyTexts(s.read.answers, s.override.texts ?? []) };
  return { sheets, failed };
}

// Who a page says it belongs to: the roster entry its name stands for, or the
// written name itself when there is no roster or no entry fits. Null for a
// page without a readable name.
function nameKey(name: string | null, roster: string[]): string | null {
  const written = name ? stripNameLabel(name) : '';
  if (!written) return null;
  return normalizeName(rosterName(written, roster) ?? written) || null;
}

// Does a page carry on this sheet's questions? It must start where the sheet
// stopped or later: its first question may be the sheet's last one (an answer
// running over the page), never an earlier one. An empty page adds nothing.
function continues(sheet: Sheet, page: KlasikRead): boolean {
  const answered = (r: KlasikRead) => r.answers.filter((a) => a.q > 0 && answerText(a).trim()).map((a) => a.q);
  const qs = answered(page);
  return !qs.length || Math.min(...qs) >= Math.max(0, ...answered(sheet.read));
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

// Writing the rubric has no question for: written under no number (q = 0)
// or under a number the exam does not have. It is never graded, so the
// teacher is told, rather than the student silently losing it.
export function strayWriting(read: KlasikRead, rubricQs: number[]): string[] {
  return read.answers
    .filter((a) => !rubricQs.includes(a.q) && answerText(a).trim())
    .map((a) => {
      const text = answerText(a).replace(/\s+/g, ' ').trim();
      const where = a.q === 0 ? 'Soru numarası olmayan yazı' : `Sınavda olmayan ${a.q}. soru altında yazı`;
      return `${where}: "${text.length > 80 ? `${text.slice(0, 80)}…` : text}" — doğru sorunun okumasına taşıyın`;
    });
}
