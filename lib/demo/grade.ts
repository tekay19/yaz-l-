import type { KlasikGrade, KlasikRead, Rubric } from '@/lib/types';
import type { Reader, Usage } from '@/lib/reader/types';
import { answerText, mergeSheets, type SheetPage } from '@/lib/klasik/sheets';
import { failedGrade, toGrade } from '@/lib/klasik/grade';
import { FLAG_TEXT, INFO_FLAGS, attentionFlags, scoreSheet, type QuestionScore } from '@/lib/klasik/score';
import { expectedFor, type Expected } from './exam';

// One student's pages (front first, then back sides) graded the way the
// product grades a klasik sheet — the same merge, grading call and scoring —
// without the database, the queue or the teacher's review step.

export type DemoQuestion = QuestionScore & {
  lines: { text: string; crossed: boolean }[];
  attention: string[]; info: string[];
};
export type DemoSheet = {
  student: string | null; pages: number;
  total: number; max: number; percent: number;
  questions: DemoQuestion[];
  expected: Expected | null;
  usage: Usage; ms: number;
};

const asPage = (read: KlasikRead, seq: number): SheetPage => ({
  id: `p${seq}`, seq, status: 'read', error: null, filePath: null,
  result: { type: 'klasik-student', read }, override: null, grade: null, gradedRev: 0, gradeAttempts: 0,
});

export async function gradeDemoSheets(reader: Reader, rubric: Rubric, reads: KlasikRead[]): Promise<DemoSheet[]> {
  const { sheets } = mergeSheets(reads.map((r, i) => asPage(r, i + 1)));
  const out: DemoSheet[] = [];
  for (const sheet of sheets) {
    const started = Date.now();
    const answerOf = (q: number) => sheet.read.answers.find((a) => a.q === q);
    // only answered questions go to the model; a blank one scores 0 by itself
    const todo = rubric.questions.filter((rq) => answerText(answerOf(rq.q)).trim());
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };
    let grade: KlasikGrade = { questions: [] };
    if (todo.length) {
      const answers = todo.map((rq) => answerOf(rq.q)!);
      const res = await reader.gradeKlasik({ questions: todo, answers, images: [] });
      usage = res.usage;
      grade = {
        questions: todo.map((rq, i) => {
          const o = res.read.questions.find((x) => x.q === rq.q);
          return o ? toGrade(rq, o, answers[i].hasFigure) : failedGrade(rq);
        }),
      };
    }
    const score = scoreSheet(rubric, { read: sheet.read, override: {}, grade });
    out.push({
      student: sheet.read.studentName,
      pages: sheet.pageIds.length,
      total: score.total, max: score.max, percent: score.percent,
      questions: score.questions.map((s) => ({
        ...s,
        lines: answerOf(s.q)?.lines ?? [],
        attention: attentionFlags(s).map((f) => FLAG_TEXT[f]),
        info: s.flags.filter((f) => INFO_FLAGS.has(f) && f !== 'pending').map((f) => FLAG_TEXT[f]),
      })),
      expected: expectedFor(sheet.read.studentName),
      usage, ms: Date.now() - started,
    });
  }
  return out;
}
