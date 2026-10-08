import { describe, expect, it } from 'vitest';
import { quoteFound } from '@/lib/klasik/evidence';
import { answerText, mergeSheets, nameFixes, type SheetPage } from '@/lib/klasik/sheets';
import { RubricInput, amendRubric, fromInput, normalizeDraft, rubricProblems, splitPoints } from '@/lib/klasik/rubric';
import { failedGrade, toGrade } from '@/lib/klasik/grade';
import type { KlasikRead, RubricQuestion } from '@/lib/types';
import { keyPointsOf } from '@/lib/klasik/worker';
import { cleanName, markContinuation } from '@/worker/process';

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
  it('joins a later page without a name to its student even when it was read as a front', () => {
    // a four-page exam, the name only on the first page; the last page looks
    // like a front to the reader (a printed header, no name field)
    const qa = (...qs: number[]) => qs.map((q) => ({ q, lines: lines(`${q}. cevap`), unclear: false, hasFigure: false }));
    const reads: Partial<KlasikRead>[] = [
      { studentName: 'Elif Yıldız', answers: qa(1) }, { isBackSide: true, answers: qa(2, 3) },
      { isBackSide: true, answers: qa(4, 5) }, { isBackSide: false, answers: qa(6, 7) },
      { studentName: 'Mert Kaya', answers: qa(1) }, { isBackSide: false, answers: qa(2, 3) },
      // a student who forgot the name: the first question starts a sheet of its own
      { isBackSide: false, answers: qa(1) },
    ];
    const full = (r: Partial<KlasikRead>): KlasikRead => ({ isBackSide: false, studentName: null, nameConfidence: 'high', unreadable: false, answers: [], ...r });
    const { sheets } = mergeSheets(reads.map((r, i) => page(i + 1, markContinuation(full(r)))));
    expect(sheets.map((s) => s.seqs)).toEqual([[1, 2, 3, 4], [5, 6], [7]]);
  });

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

  // a four-page exam, the student's name on every page
  const ans = (...qs: number[]) => qs.map((q) => ({ q, lines: lines(`${q}. cevap`), unclear: false, hasFigure: false }));

  it('joins the pages of a student by the name on them, in any upload order', () => {
    // photographed in stacks: every first page, then every second page
    const { sheets } = mergeSheets([
      page(1, { studentName: 'Elif Yıldız', answers: ans(1, 2) }),
      page(2, { studentName: 'Mert Kaya', answers: ans(1, 2) }),
      page(3, { studentName: 'Ad: Elif Yildiz', answers: ans(3, 4) }), // labelled, and without the Turkish letters
      page(4, { studentName: 'M. Kaya', answers: ans(3, 4) }),     // shortened on the later page
    ], ['Elif Yıldız', 'Mert Kaya']);
    expect(sheets.map((s) => s.pageIds)).toEqual([['p1', 'p3'], ['p2', 'p4']]);
    // without a roster the written names themselves group the pages
    const { sheets: bare } = mergeSheets([page(1, { studentName: 'Mert Kaya', answers: ans(1) }), page(2, { studentName: 'Ali Can', answers: ans(1) }), page(3, { studentName: 'mert kaya', answers: ans(2) })]);
    expect(bare.map((s) => s.pageIds)).toEqual([['p1', 'p3'], ['p2']]);
    // a shortening two roster entries fit is no match: that page stays apart for the teacher
    const { sheets: twoMs } = mergeSheets([page(1, { studentName: 'Mert Kaya', answers: ans(1) }), page(2, { studentName: 'M. Kaya', answers: ans(1) })], ['Mert Kaya', 'Melis Kaya']);
    expect(twoMs.map((s) => s.pageIds)).toEqual([['p1'], ['p2']]);
  });

  it('continues an unsigned later page, but not one that answers the same questions again', () => {
    const { sheets } = mergeSheets([
      page(1, { studentName: 'Elif', answers: ans(1, 2) }),
      page(2, { isBackSide: true, answers: ans(3, 4) }), // Elif's next page, no name on it
      page(3, { isBackSide: true, answers: ans(4, 5) }), // and the next: question 4 runs on
      page(4, { answers: ans(1, 2) }),          // a first page under an empty name field: someone else
    ]);
    expect(sheets.map((s) => s.pageIds)).toEqual([['p1', 'p2', 'p3'], ['p4']]);
    expect(sheets[0].read.answers.map((a) => a.q)).toEqual([1, 2, 3, 4, 5]);
  });

  it('never puts two first pages on one sheet, even when one of them is blank', () => {
    // Elif left her first page empty; the next student forgot to sign theirs
    const { sheets } = mergeSheets([
      page(1, { studentName: 'Elif', answers: [] }),
      page(2, { answers: ans(1) }),
      page(3, { isBackSide: true, answers: ans(2, 3) }),
    ]);
    expect(sheets.map((s) => s.pageIds)).toEqual([['p1'], ['p2', 'p3']]);
  });

  it('sorts pages photographed in stacks: every first page, then every second page', () => {
    const front = (seq: number, studentName: string | null) => page(seq, { studentName, answers: ans(1, 2) });
    const back = (seq: number, studentName: string | null = null) => page(seq, { isBackSide: true, studentName, answers: ans(3, 4) });
    const { sheets } = mergeSheets([
      front(1, 'Elif Yıldız'), front(2, 'Mert Kaya'), front(3, null), // the third forgot to sign the first page
      back(4), back(5), back(6, 'Ad: Zeynep Arslan'),                  // ... and signed the second
    ], ['Elif Yıldız', 'Mert Kaya', 'Zeynep Arslan']);
    expect(sheets.map((s) => s.pageIds)).toEqual([['p1', 'p4'], ['p2', 'p5'], ['p3', 'p6']]);
    expect(sheets[2].read.studentName).toBe('Ad: Zeynep Arslan');
    // student by student, the same pages stay with the page before them
    const { sheets: inOrder } = mergeSheets([front(1, 'Elif Yıldız'), back(2), front(3, 'Mert Kaya'), back(4)], ['Elif Yıldız', 'Mert Kaya']);
    expect(inOrder.map((s) => s.pageIds)).toEqual([['p1', 'p2'], ['p3', 'p4']]);
  });

  it('lets a name written only on a later page sign the pages before it', () => {
    const { sheets } = mergeSheets([
      page(1, { studentName: 'Elif', answers: ans(1, 2) }),
      page(2, { answers: ans(1, 2) }),          // name field left empty
      page(3, { isBackSide: true, studentName: 'Zeynep', nameConfidence: 'high', answers: ans(3, 4) }), // signed in the margin
    ]);
    expect(sheets.map((s) => s.pageIds)).toEqual([['p1'], ['p2', 'p3']]);
    expect(sheets[1].read.studentName).toBe('Zeynep');
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
    expect(rubricProblems({ questions: [] })).toEqual(['Cevap anahtarında hiç soru bulunamadı.']);
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

describe('gradeInChunks on a cut-off answer', () => {
  it('halves a group whose verdicts ran past the output limit', async () => {
    const { gradeInChunks } = await import('@/lib/klasik/chunks');
    const { OutputTruncated } = await import('@/lib/reader/types');
    const calls: number[][] = [];
    const reader: any = {
      gradeKlasik: async ({ questions }: any) => {
        calls.push(questions.map((q: any) => q.q));
        if (questions.length > 2) throw new OutputTruncated('max_tokens');
        return { read: { questions: questions.map((q: any) => ({ q: q.q })) }, usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    const qs = Array.from({ length: 5 }, (_, i) => ({ q: i + 1 }));
    const answers = qs.map((q) => ({ q: q.q, lines: [], unclear: false, hasFigure: false }));
    const out = await gradeInChunks(reader, { questions: qs as any, answers, images: [] }, 5);
    expect(out.read.questions.map((q: any) => q.q)).toEqual([1, 2, 3, 4, 5]);
    expect(calls).toEqual([[1, 2, 3, 4, 5], [1, 2, 3], [4, 5], [1, 2], [3]]);
  });

  it('gives up on a single question that still does not fit', async () => {
    const { gradeInChunks } = await import('@/lib/klasik/chunks');
    const { OutputTruncated } = await import('@/lib/reader/types');
    const reader: any = { gradeKlasik: async () => { throw new OutputTruncated('max_tokens'); } };
    const answers = [{ q: 1, lines: [], unclear: false, hasFigure: false }];
    await expect(gradeInChunks(reader, { questions: [{ q: 1 }] as any, answers, images: [] })).rejects.toBeInstanceOf(OutputTruncated);
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

describe('keyPointsOf', () => {
  const key = (answers: { q: number; text: string[] }[]) => ({
    result: { type: 'klasik-key' as const, read: { isBackSide: false, studentName: null, nameConfidence: 'high' as const, unreadable: false,
      answers: answers.map((a) => ({ q: a.q, lines: a.text.map((text) => ({ text, crossed: false })), unclear: false, hasFigure: false })) } },
  });
  it('takes the points printed with each question on the key', () => {
    expect(keyPointsOf([key([
      { q: 1, text: ['Soru: K değerini işlemlerinizi göstererek bulunuz. (15 puan)', 'K = 5006'] },
      { q: 2, text: ['Soru: Sonucu bulunuz. (12,5 Puan)', '√5/3'] },
    ]), key([{ q: 4, text: ['Soru: A ∩ B kümesini yazınız. (10 puan)', '[800, 1200]'] }])])).toEqual([15, 12.5, 0, 10]);
  });
  it('gives nothing when the key prints no points, or only inside an answer', () => {
    expect(keyPointsOf([key([{ q: 1, text: ['Soru: Açıklayınız.', 'Her doğru fikir (5 puan)'] }])])).toEqual([]);
    expect(keyPointsOf([{ result: null }])).toEqual([]);
  });
});

describe('cleanName', () => {
  const name = (studentName: string | null) =>
    cleanName({ isBackSide: false, studentName, nameConfidence: 'high', unreadable: false, answers: [] }).studentName;
  it('drops a label written before the name', () => {
    expect(name('Ad: Burak Demir')).toBe('Burak Demir');
    expect(name('Ad Burak Demir')).toBe('Burak Demir');
    expect(name('Adı: Elif Şahin')).toBe('Elif Şahin');
    expect(name('ADI SOYADI: Zeynep Kaya')).toBe('Zeynep Kaya');
    expect(name('İsim - Can Öztürk')).toBe('Can Öztürk');
  });
  it('leaves names that only start like a label, and a lone label', () => {
    expect(name('Adem Yılmaz')).toBe('Adem Yılmaz');
    expect(name('Ada Kaya')).toBe('Ada Kaya');
    expect(name('Adil Koç')).toBe('Adil Koç');
    expect(name('Ad:')).toBe('Ad:');
    expect(name(null)).toBeNull();
  });
  it('reads a number alone as no name, so the page joins its student by its questions', () => {
    expect(name('Öğrenci 17')).toBeNull();
    expect(name('1101901107')).toBeNull();
    expect(name('Elif Yıldız 9/A')).toBe('Elif Yıldız 9/A');
    const back = markContinuation(cleanName({ isBackSide: false, studentName: '17', nameConfidence: 'high', unreadable: false, answers: [{ q: 4, lines: [{ text: 'x = 2', crossed: false }], unclear: false, hasFigure: false }] }));
    expect(back.isBackSide).toBe(true);
  });
});

describe('nameFixes', () => {
  const qa = (...qs: number[]) => qs.map((q) => ({ q, lines: lines(`${q}. cevap`), unclear: false, hasFigure: false }));
  it('gives a page whose name was misread the name on the student\'s other pages', () => {
    const rows = [
      page(1, { studentName: 'Emre Şahin', answers: qa(1) }), page(2, { studentName: 'Emre Şahin', answers: qa(2, 3) }),
      page(3, { studentName: 'Seltin Aydın', answers: qa(1) }), page(4, { studentName: 'Selin Aydın', answers: qa(2, 3) }),
      page(5, { studentName: 'Ad: Selin Aydın', answers: qa(4, 5) }),
    ];
    const fixes = nameFixes(rows);
    expect([...fixes]).toEqual([['p3', 'Selin Aydın']]);
    const mended = rows.map((p) => (fixes.has(p.id) && p.result?.type === 'klasik-student'
      ? { ...p, result: { ...p.result, read: { ...p.result.read, studentName: fixes.get(p.id)! } } } : p));
    expect(mergeSheets(mended).sheets.map((s) => s.seqs)).toEqual([[1, 2], [3, 4, 5]]);
  });

  it('also mends a first page with only the name on it (the first question left blank)', () => {
    expect([...nameFixes([
      page(1, { studentName: 'Deniz Köş', answers: [{ q: 1, lines: [], unclear: false, hasFigure: false }] }),
      page(2, { studentName: 'Deniz Koç', answers: qa(2, 3) }), page(3, { studentName: 'Deniz Koç', answers: qa(4, 5) }),
    ])]).toEqual([['p1', 'Deniz Koç']]);
    // but a blank page is never joined to a student who starts from the first question
    expect(nameFixes([
      page(1, { studentName: 'Ali Kaya', answers: [] }), page(2, { studentName: 'Ali Kara', answers: qa(1, 2) }),
    ]).size).toBe(0);
  });

  it('never joins two students with close names', () => {
    // the second starts again from the first question: another student
    expect(nameFixes([
      page(1, { studentName: 'Ali Kaya', answers: qa(1, 2) }), page(2, { studentName: 'Ali Kara', answers: qa(1, 2) }),
    ]).size).toBe(0);
  });
});
