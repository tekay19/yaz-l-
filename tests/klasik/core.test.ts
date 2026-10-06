import { describe, expect, it } from 'vitest';
import { quoteFound } from '@/lib/klasik/evidence';
import { answerText, mergeSheets, type SheetPage } from '@/lib/klasik/sheets';
import { RubricInput, amendRubric, fromInput, normalizeDraft, rubricProblems, splitPoints } from '@/lib/klasik/rubric';
import { failedGrade, toGrade } from '@/lib/klasik/grade';
import type { KlasikRead, RubricQuestion } from '@/lib/types';

describe('quoteFound', () => {
  it('forgives case, spacing, quote marks and uncertainty markers', () => {
    expect(quoteFound('x=4', 'x = 4')).toBe(true);
    expect(quoteFound('KLOROPLAST', 'Kloroplastta gerçekleşir.')).toBe(true);
    expect(quoteFound('İÇİNDEKİ HÜZÜN', 'içindeki hüzün')).toBe(true);
    expect(quoteFound('“şair özlemini anlatır”', 'Şair [?özlemini] anlatır')).toBe(true);
  });

  it('forgives a word in a long quote but not a paraphrase or an invention', () => {
    const text = 'Liriktir çünkü şair sevdiğinden ayrı kalmanın hüznünü ve özlemini anlatıyor.';
    expect(quoteFound('şair sevdiğinden ayrı kalmanın hüznünü ve derin özlemini anlatıyor', text)).toBe(true);
    expect(quoteFound('şairin duyguları ön planda', 'Şair duygularını anlatır.')).toBe(false);
    expect(quoteFound('duygular ön plandadır', 'Olay anlatır.')).toBe(false);
    expect(quoteFound('', text)).toBe(false);
    expect(quoteFound('x = 5', 'x = 4')).toBe(false);
  });

  it('matches a number only as the whole number on the paper', () => {
    expect(quoteFound('x = 2', 'x = 25')).toBe(false);
    expect(quoteFound('4', 'x = 14')).toBe(false);
    expect(quoteFound('x = 4', 'x = 4,5')).toBe(false);
    expect(quoteFound('x = 4', 'x = 4.5')).toBe(false);
    expect(quoteFound('x = 4', 'x = 4. Sonuç bu.')).toBe(true);
    expect(quoteFound('25', 'x = 25 cm')).toBe(true);
  });

  it('forgives a period the student never wrote', () => {
    expect(quoteFound('x = 4.', 'x = 4')).toBe(true);
    expect(quoteFound('(kloroplast)', 'kloroplastta')).toBe(true);
  });

  it('treats a capital I without its dot as i', () => {
    expect(quoteFound('istanbul', 'ISTANBUL')).toBe(true);
    expect(quoteFound('İSTANBUL', 'istanbul')).toBe(true);
  });
});

const page = (seq: number, read: Partial<KlasikRead> | null, over: Partial<SheetPage> = {}): SheetPage => ({
  id: `p${seq}`, seq, status: read ? 'read' : 'failed', error: read ? null : 'unreadable', filePath: `jobs/j/${seq}.jpg`,
  result: read ? { type: 'klasik-student', read: { isBackSide: false, studentName: null, nameConfidence: 'high', unreadable: false, answers: [], ...read } } : null,
  override: null, grade: null, gradedRev: 0, gradeAttempts: 0, ...over,
});
const lines = (...t: string[]) => t.map((text) => ({ text, crossed: false }));

describe('mergeSheets', () => {
  it('appends a back side, continuing an answer that ran over the page break', () => {
    const { sheets, failed } = mergeSheets([
      page(2, { isBackSide: true, answers: [{ q: 2, lines: lines('devamı'), unclear: true, hasFigure: false }, { q: 3, lines: lines('3 cevap'), unclear: false, hasFigure: false }] }),
      page(1, { studentName: 'Elif', answers: [{ q: 1, lines: lines('1 cevap'), unclear: false, hasFigure: false }, { q: 2, lines: lines('başı'), unclear: false, hasFigure: false }] }),
    ]);
    expect(failed).toEqual([]);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toMatchObject({ pageId: 'p1', pageIds: ['p1', 'p2'], seqs: [1, 2], filePaths: ['jobs/j/1.jpg', 'jobs/j/2.jpg'] });
    expect(sheets[0].read.answers.map((a) => [a.q, answerText(a)])).toEqual([[1, '1 cevap'], [2, 'başı\ndevamı'], [3, '3 cevap']]);
    expect(sheets[0].read.answers[1].unclear).toBe(true);
  });

  it('keeps a back side on its own when the page before it could not be read', () => {
    const { sheets, failed } = mergeSheets([
      page(1, { studentName: 'Elif' }), page(2, null), page(3, { isBackSide: true }),
    ]);
    expect(sheets.map((s) => s.pageIds)).toEqual([['p1'], ['p3']]);
    expect(failed.map((f) => f.seq)).toEqual([2]);
  });

  it('lets the teacher\'s transcription fix replace or add an answer', () => {
    const { sheets } = mergeSheets([
      page(1, { answers: [{ q: 1, lines: [{ text: 'x = 3', crossed: true }, { text: 'x = [?]', crossed: false }], unclear: true, hasFigure: false }] },
        { override: { texts: [{ q: 1, text: 'x = 4' }, { q: 2, text: 'ikinci\nsatır' }] } }),
    ]);
    expect(sheets[0].read.answers.map((a) => [a.q, answerText(a), a.unclear])).toEqual([[1, 'x = 4', false], [2, 'ikinci\nsatır', false]]);
  });
});

describe('rubric', () => {
  const draft = {
    questions: [
      { q: 2, type: 'yorum' as const, prompt: null, answer: 'Duygu ön planda.', workRequired: true, accepted: [' ', 'Örnek vermek de olur'],
        criteria: [{ text: 'Duyguyu açıklar', points: 2, role: 'result' as const, required: false }, { text: 'Örnek verir', points: 1, role: 'other' as const, required: false }] },
      { q: 1, type: 'islem' as const, prompt: '2x+3=11', answer: 'x = 4', workRequired: true, accepted: [],
        criteria: [{ text: 'Kurulum', points: 3, role: 'other' as const, required: false }, { text: 'Adımlar', points: 3, role: 'other' as const, required: false }, { text: 'Sonuç', points: 4, role: 'result' as const, required: false }] },
      { q: 1, type: 'kisa' as const, prompt: null, answer: 'tekrar', workRequired: false, accepted: [], criteria: [] },
      { q: 3, type: 'kisa' as const, prompt: null, answer: 'Kloroplast', workRequired: true, accepted: [], criteria: [] },
    ],
  };

  it('turns a draft into an approvable rubric on the teacher\'s maxima', () => {
    const r = normalizeDraft(draft, [20, 15]);
    expect(r.questions.map((q) => q.q)).toEqual([1, 2, 3]);
    const [q1, q2, q3] = r.questions;
    expect(q1.criteria.map((c) => [c.id, c.points])).toEqual([['c1', 6], ['c2', 6], ['c3', 8]]);
    expect(q1.policy).toEqual({ workRequired: true, carryForward: true, wrongInfoPenalty: false, style: 'balanced' });
    expect(q2.criteria.map((c) => [c.points, c.role])).toEqual([[10, 'other'], [5, 'other']]); // yorum has no result rule
    expect(q2.accepted).toEqual([{ text: 'Örnek vermek de olur', example: null, by: 'ai' }]);
    expect(q2.policy.workRequired).toBe(false);
    expect(q3.criteria).toEqual([{ id: 'c1', text: 'Cevap doğru', points: 10, role: 'result', required: false }]);
    expect(q3.policy.workRequired).toBe(false); // a short answer never needs work shown
    expect(r.questions.every((q) => q.rev === 1)).toBe(true);
  });

  it('splits points exactly, in halves', () => {
    for (const [w, max] of [[[1, 1, 1], 10], [[3, 3, 4], 7], [[5], 3], [[1, 2], 1]] as [number[], number][]) {
      const pts = splitPoints(w, max);
      expect(pts.reduce((s, p) => s + p, 0)).toBe(max);
      expect(pts.every((p) => p > 0 && Number.isInteger(p * 2))).toBe(true);
    }
  });

  it('never lets the criteria of a small question add up past its maximum', () => {
    const draft = { questions: [{ q: 1, type: 'islem' as const, prompt: null, answer: 'x = 4', workRequired: true, accepted: [],
      criteria: [
        { text: 'Kurulum', points: 1, role: 'other' as const, required: false },
        { text: 'Adım', points: 1, role: 'other' as const, required: false },
        { text: 'Sonuç', points: 1, role: 'result' as const, required: false },
      ] }] };
    const [q] = normalizeDraft(draft, [1]).questions;
    expect(q.criteria.reduce((s, c) => s + c.points, 0)).toBe(1);
    expect(q.criteria.some((c) => c.role === 'result')).toBe(true);
    expect(splitPoints([10, 1, 1], 1.5)).toEqual([0.5, 0.5, 0.5]);
  });

  it('validates what the editor sends', () => {
    const q = { q: 1, type: 'islem', prompt: null, answer: 'x = 4', accepted: [], policy: { workRequired: true, carryForward: true, wrongInfoPenalty: false },
      criteria: [{ id: 'c1', text: 'Sonuç', points: 10, role: 'result', required: false }] };
    expect(RubricInput.safeParse({ questions: [q] }).success).toBe(true);
    expect(RubricInput.safeParse({ questions: [q, q] }).success).toBe(false);
    expect(RubricInput.safeParse({ questions: [{ ...q, criteria: [] }] }).success).toBe(false);
    expect(RubricInput.safeParse({ questions: [{ ...q, criteria: [{ ...q.criteria[0], points: 0 }] }] }).success).toBe(false);
    expect(RubricInput.safeParse({ questions: [{ ...q, criteria: [q.criteria[0], q.criteria[0]] }] }).success).toBe(false);
    const r = fromInput(RubricInput.parse({ questions: [{ ...q, type: 'yorum', prompt: '' }] }));
    expect(r.questions[0]).toMatchObject({ rev: 1, prompt: null, criteria: [{ role: 'other' }] });
    expect(rubricProblems(r)).toEqual([]);
    expect(rubricProblems({ questions: [] })).toEqual(['Rubrikte hiç soru yok.']);
  });

  it('adds an accepted answer and sends only that question back for grading', () => {
    const r = normalizeDraft(draft, []);
    const amended = amendRubric(r, 1, { text: 'Öğretmen kabul etti', example: 'x = (11-3)/2 = 4', by: 'teacher' });
    expect(amended.questions.map((q) => q.rev)).toEqual([2, 1, 1]);
    expect(amended.questions[0].accepted).toHaveLength(1);
    expect(r.questions[0].rev).toBe(1); // the original is untouched
  });
});

describe('toGrade', () => {
  const rq: RubricQuestion = {
    q: 4, rev: 3, type: 'yorum', prompt: null, answer: '', accepted: [],
    criteria: [{ id: 'c1', text: 'Fikir', points: 5, role: 'other', required: false }],
    policy: { workRequired: false, carryForward: true, wrongInfoPenalty: false },
  };
  it('stamps the revision, drops unknown criteria and result fields for yorum', () => {
    const g = toGrade(rq, {
      q: 4, criteria: [{ id: 'c1', verdict: 'met', evidence: 'x', slipOnly: false }, { id: 'zz', verdict: 'met', evidence: 'y', slipOnly: false }],
      resultCorrect: true, resultPath: 'valid', firstError: null, errorKind: null, flags: ['wrong_info', 'wrong_info'], confidence: 'high', note: 'ok',
    }, true);
    expect(g).toMatchObject({ q: 4, rev: 3, criteria: [{ id: 'c1' }], resultCorrect: null, resultPath: null, flags: ['wrong_info'], confidence: 'low', textOnly: true });
    expect(failedGrade(rq)).toMatchObject({ q: 4, rev: 3, failed: true });
  });
});

describe('quoteFound and the prompt line numbers', () => {
  it('ignores the line numbers a model copies from the grading prompt', () => {
    const text = 'Bir şeyi öğrenmenin en iyi zamanı küçüklüktür,\nbüyüyünce huylar zor değişir.';
    expect(quoteFound('1. Bir şeyi öğrenmenin en iyi zamanı küçüklüktür,\n2. büyüyünce huylar zor değişir.', text)).toBe(true);
    // a number that is part of the answer still has to be on the paper
    expect(quoteFound('x = 4', '3x = 12\nx = 4')).toBe(true);
    expect(quoteFound('2. x = 5', 'x = 4')).toBe(false);
  });
});

describe('gradeInChunks', () => {
  it('grades a long sheet a few questions per call, in parallel, and joins the verdicts', async () => {
    const { gradeInChunks } = await import('@/lib/klasik/chunks');
    const calls: number[][] = [];
    const reader: any = {
      gradeKlasik: async ({ questions, images }: any) => {
        calls.push(questions.map((q: any) => q.q));
        return { read: { questions: questions.map((q: any) => ({ q: q.q, images: images.length })) }, usage: { inputTokens: 10, outputTokens: 1 } };
      },
    };
    const qs = Array.from({ length: 12 }, (_, i) => ({ q: i + 1 }));
    const answers = qs.map((q) => ({ q: q.q, lines: [], unclear: false, hasFigure: q.q === 7 }));
    const out = await gradeInChunks(reader, { questions: qs as any, answers, images: [Buffer.from('jpg')] }, 5);
    expect(calls).toEqual([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12]]);
    expect(out.read.questions.map((q: any) => q.q)).toEqual(qs.map((q) => q.q));
    // only the group with a figure gets the photos
    expect(out.read.questions.map((q: any) => q.images)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0]);
    expect(out.usage).toEqual({ inputTokens: 30, outputTokens: 3 });
  });
});

describe('strayWriting', () => {
  it('tells the teacher about writing no rubric question will grade', async () => {
    const { strayWriting } = await import('@/lib/klasik/sheets');
    const read: KlasikRead = { isBackSide: false, studentName: 'Elif', nameConfidence: 'high', unreadable: false, answers: [
      { q: 0, lines: lines('Fotosentez kloroplastta olur.'), unclear: false, hasFigure: false },
      { q: 2, lines: lines('x = 4'), unclear: false, hasFigure: false },
      { q: 7, lines: lines('Mitokondri'), unclear: false, hasFigure: false },
      { q: 8, lines: [{ text: 'silinmiş', crossed: true }], unclear: false, hasFigure: false },
    ] };
    const notes = strayWriting(read, [1, 2, 3]);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('Soru numarası olmayan yazı: "Fotosentez kloroplastta olur."');
    expect(notes[1]).toContain('Sınavda olmayan 7. soru');
  });
});
