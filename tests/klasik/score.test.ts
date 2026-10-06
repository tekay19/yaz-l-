import { describe, expect, it } from 'vitest';
import { scoreQuestion, scoreSheet, attentionFlags } from '@/lib/klasik/score';
import type { KlasikAnswer, QuestionGrade, RubricQuestion, Verdict } from '@/lib/types';

// 2x + 3 = 11, işlemleriyle: setup 3 + steps 3 + result 4
const islem = (over: Partial<RubricQuestion> = {}): RubricQuestion => ({
  q: 1, rev: 1, type: 'islem', prompt: '2x + 3 = 11 denklemini çözünüz.', answer: '2x = 8, x = 4',
  criteria: [
    { id: 'c1', text: 'Denklemi doğru düzenler', points: 3, role: 'other', required: false },
    { id: 'c2', text: 'Geçerli adımlarla x\'i yalnız bırakır (yöntem serbest)', points: 3, role: 'other', required: false },
    { id: 'c3', text: 'Sonuç doğru ve öğrencinin geçerli adımlarından çıkıyor', points: 4, role: 'result', required: false },
  ],
  accepted: [],
  policy: { workRequired: true, carryForward: true, wrongInfoPenalty: false },
  ...over,
});
const yorum = (): RubricQuestion => ({
  q: 1, rev: 1, type: 'yorum', prompt: 'Lirik şiirin özelliklerini açıklayınız.', answer: 'Duygu ön planda; öznel; ahenk önemli.',
  criteria: [
    { id: 'c1', text: 'Duygu ve coşkunun ön planda olduğunu açıklar', points: 4, role: 'other', required: false },
    { id: 'c2', text: 'Öznel bakışı belirtir', points: 3, role: 'other', required: false },
    { id: 'c3', text: 'Ahengin önemini belirtir', points: 3, role: 'other', required: false },
  ],
  accepted: [],
  policy: { workRequired: false, carryForward: true, wrongInfoPenalty: false },
});
const answer = (...lines: string[]): KlasikAnswer => ({ q: 1, lines: lines.map((text) => ({ text, crossed: false })), unclear: false, hasFigure: false });
const v = (id: string, verdict: Verdict, evidence = '') => ({ id, verdict, evidence });
const grade = (over: Partial<QuestionGrade>): QuestionGrade => ({
  q: 1, rev: 1, criteria: [], resultCorrect: null, resultPath: null, firstError: null, errorKind: null,
  flags: [], confidence: 'high', note: '', failed: false, textOnly: false, ...over,
});
const solved = answer('2x + 3 = 11', '2x = 11 - 3', '2x = 8', 'x = 4');
const allMet = [v('c1', 'met', '2x = 11 - 3'), v('c2', 'met', '2x = 8'), v('c3', 'met', 'x = 4')];

describe('scoreQuestion — the agreed case table', () => {
  it('right way, right result: full marks, nothing to check', () => {
    const s = scoreQuestion(islem(), solved, grade({ criteria: allMet, resultCorrect: true, resultPath: 'valid' }));
    expect([s.points, s.status]).toEqual([10, 'graded']);
    expect(attentionFlags(s)).toEqual([]);
  });

  it('a different valid method earns full marks; the flag only informs', () => {
    const s = scoreQuestion(islem(), answer('x = (11 - 3) / 2', 'x = 4'), grade({
      criteria: [v('c1', 'met', 'x = (11 - 3) / 2'), v('c2', 'met', 'x = (11 - 3) / 2'), v('c3', 'met', 'x = 4')],
      resultCorrect: true, resultPath: 'valid', flags: ['alternative_path'],
    }));
    expect(s.points).toBe(10);
    expect(s.flags).toContain('alternative_path');
    expect(attentionFlags(s)).toEqual([]);
  });

  it('a right result through an invalid step: no result points, even if the model said met', () => {
    const q = islem({ answer: '16/64 = 1/4' });
    const s = scoreQuestion(q, answer('16/64', '6\'lar sadeleşir', '= 1/4'), grade({
      criteria: [v('c1', 'met', '16/64'), v('c2', 'not_met'), v('c3', 'met', '= 1/4')],
      resultCorrect: true, resultPath: 'invalid', firstError: '6\'lar sadeleşir', errorKind: 'yontem',
    }));
    expect(s.points).toBe(3);
    expect(s.flags).toContain('invalid_path');
    expect(s.criteria.find((c) => c.id === 'c3')).toMatchObject({ verdict: 'met', counted: false, earned: 0 });
  });

  it('two errors that cancel out count as an invalid path', () => {
    const s = scoreQuestion(islem(), answer('2x = 11 + 3', '2x = 8', 'x = 4'), grade({
      criteria: [v('c1', 'not_met'), v('c2', 'not_met'), v('c3', 'met', 'x = 4')],
      resultCorrect: true, resultPath: 'invalid', flags: ['compensating_errors'],
    }));
    expect(s.points).toBe(0);
    expect(s.flags).toEqual(expect.arrayContaining(['compensating_errors', 'invalid_path']));
  });

  it('a bare result where the work was asked for: 0 and a flag', () => {
    const s = scoreQuestion(islem(), answer('x = 4'), grade({
      criteria: [v('c1', 'met', 'x = 4'), v('c3', 'met', 'x = 4')], resultCorrect: true, resultPath: 'none',
    }));
    expect(s.points).toBe(0);
    expect(s.flags).toContain('unsupported_result');
  });

  it('a bare result where only the result was asked for: full marks', () => {
    const q = islem({ policy: { workRequired: false, carryForward: true, wrongInfoPenalty: false } });
    const s = scoreQuestion(q, answer('x = 4'), grade({ criteria: [v('c3', 'met', 'x = 4')], resultCorrect: true, resultPath: 'none' }));
    expect(s.points).toBe(10);
    expect(s.flags).not.toContain('unsupported_result');
  });

  it('a bare result is not given full marks unless the paper shows it', () => {
    const q = islem({ policy: { workRequired: false, carryForward: true, wrongInfoPenalty: false } });
    // the model says the result is right but did not meet the result criterion
    const contradicts = scoreQuestion(q, answer('x = 4'), grade({ criteria: [v('c3', 'not_met')], resultCorrect: true, resultPath: 'none' }));
    expect(contradicts.points).toBe(0);
    expect(attentionFlags(contradicts)).toContain('low_confidence');
    // a quote that is not on the paper earns nothing either
    const invented = scoreQuestion(q, answer('x = 5'), grade({ criteria: [v('c3', 'met', 'x = 4')], resultCorrect: true, resultPath: 'none' }));
    expect(invented.points).toBe(0);
    expect(invented.flags).toContain('evidence_unverified');
  });

  it('a short answer that is partly right earns half, a contradiction earns nothing', () => {
    const kisa = (): RubricQuestion => ({
      q: 1, rev: 1, type: 'kisa', prompt: 'Değişken nedir?', answer: 'Değer saklayan adlandırılmış bellek konumu',
      criteria: [{ id: 'c1', text: 'Değer saklayan bellek konumu olduğunu belirtir', points: 10, role: 'result', required: false }],
      accepted: [], policy: { workRequired: false, carryForward: true, wrongInfoPenalty: false },
    });
    const partly = scoreQuestion(kisa(), answer('Bir değerin adıdır'), grade({
      criteria: [v('c1', 'partial', 'Bir değerin adıdır')], resultCorrect: false, resultPath: 'none',
    }));
    expect(partly.points).toBe(5);
    const right = scoreQuestion(kisa(), answer('Değer tutan bellek alanı'), grade({
      criteria: [v('c1', 'met', 'Değer tutan bellek alanı')], resultCorrect: true, resultPath: 'none',
    }));
    expect(right.points).toBe(10);
    const contradicts = scoreQuestion(kisa(), answer('Bir sayı'), grade({
      criteria: [v('c1', 'met', 'Bir sayı')], resultCorrect: false, resultPath: 'none',
    }));
    expect(contradicts.points).toBe(0);
    expect(attentionFlags(contradicts)).toContain('low_confidence');
  });

  it('valid steps that do not lead to the result keep their points, the result does not', () => {
    const s = scoreQuestion(islem(), answer('2x + 3 = 11', '2x = 11 - 3', 'x = 4'), grade({
      criteria: [v('c1', 'met', '2x = 11 - 3'), v('c2', 'not_met'), v('c3', 'met', 'x = 4')],
      resultCorrect: true, resultPath: 'unsupported',
    }));
    expect(s.points).toBe(3);
    expect(s.flags).toContain('unsupported_result');
  });

  it('an arithmetic slip: the method still earns its points, the wrong result does not', () => {
    const s = scoreQuestion(islem(), answer('2x = 11 - 3', '2x = 9', 'x = 4,5'), grade({
      criteria: [v('c1', 'met', '2x = 11 - 3'), v('c2', 'met', 'x = 4,5'), v('c3', 'not_met')],
      resultCorrect: false, resultPath: 'invalid', firstError: '2x = 9', errorKind: 'islem',
    }));
    expect(s.points).toBe(6);
    expect(s.flags).not.toContain('invalid_path'); // only a correct result is suspicious
  });

  it('never credits a quote that is not in the answer', () => {
    const s = scoreQuestion(islem(), solved, grade({
      criteria: [v('c1', 'met', '2x = 11 - 3'), v('c2', 'met', '2x - 8 = 0 olduğundan'), v('c3', 'met', 'x = 4')],
      resultCorrect: true, resultPath: 'valid',
    }));
    expect(s.points).toBe(7);
    expect(s.flags).toContain('evidence_unverified');
  });

  it('counts "partial" as half the criterion and rounds to half points', () => {
    const s = scoreQuestion(islem(), solved, grade({
      criteria: [v('c1', 'partial', '2x = 11 - 3'), v('c2', 'met', '2x = 8'), v('c3', 'met', 'x = 4')],
      resultCorrect: true, resultPath: 'valid',
    }));
    expect(s.points).toBe(8.5);
  });

  it('treats criteria the model skipped as not met and ignores ones it invented', () => {
    const s = scoreQuestion(islem(), solved, grade({
      criteria: [v('c3', 'met', 'x = 4'), v('c9', 'met', 'x = 4')], resultCorrect: true, resultPath: 'valid',
    }));
    expect(s.points).toBe(4);
  });

  it('lets the teacher\'s points override everything', () => {
    const s = scoreQuestion(islem(), answer('x = 4'), grade({ resultCorrect: true, resultPath: 'none' }), 7);
    expect([s.points, s.status]).toEqual([7, 'teacher']);
    expect(scoreQuestion(islem(), solved, undefined, 50).points).toBe(10);
  });

  it('waits for a grade made against the current revision', () => {
    const s = scoreQuestion(islem({ rev: 2 }), solved, grade({ criteria: allMet, resultCorrect: true, resultPath: 'valid' }));
    expect([s.points, s.status]).toEqual([0, 'pending']);
  });

  it('tells a missing question from a blank one and from a failed grade', () => {
    expect(scoreQuestion(islem(), undefined, undefined)).toMatchObject({ points: 0, status: 'missing', flags: ['missing'] });
    const crossedOnly: KlasikAnswer = { q: 1, lines: [{ text: 'x = 3', crossed: true }], unclear: false, hasFigure: false };
    expect(scoreQuestion(islem(), crossedOnly, undefined)).toMatchObject({ points: 0, status: 'blank', flags: [] });
    expect(scoreQuestion(islem(), solved, grade({ failed: true }))).toMatchObject({ points: 0, status: 'failed', flags: ['grading_failed'] });
  });

  it('grades yorum questions on their ideas alone, with no result rule', () => {
    const s = scoreQuestion(yorum(), answer('Şair içindeki hüznü coşkuyla anlatır.', 'Dizelerde uyak ve ritim vardır.'), grade({
      criteria: [v('c1', 'met', 'içindeki hüznü coşkuyla anlatır'), v('c2', 'not_met'), v('c3', 'partial', 'uyak ve ritim vardır')],
    }));
    expect(s.points).toBe(5.5);
  });

  it('passes the model\'s flags through and asks about figures and low confidence', () => {
    const figure: KlasikAnswer = { ...answer('çizim: üçgen ABC'), hasFigure: true };
    const s = scoreQuestion(islem(), figure, grade({
      criteria: [v('c1', 'met', 'şekildeki kurulum')], resultCorrect: false, resultPath: 'valid', confidence: 'low', flags: ['unclear_reading'],
    }));
    expect(s.points).toBe(3); // a drawing cannot be quoted, so the quote check is skipped ...
    expect(attentionFlags(s)).toEqual(expect.arrayContaining(['figure', 'low_confidence', 'unclear_reading'])); // ... and the teacher looks
  });
});

describe('scoreSheet', () => {
  it('adds questions up, honours the teacher and counts what is still pending', () => {
    const q2 = { ...yorum(), q: 2 };
    const s = scoreSheet({ questions: [islem(), q2] }, {
      read: { isBackSide: false, studentName: 'Elif', nameConfidence: 'high', unreadable: false, answers: [solved, { ...answer('Şiir duyguyu anlatır'), q: 2 }] },
      override: { points: [{ q: 2, points: 6 }] },
      grade: { questions: [grade({ criteria: allMet, resultCorrect: true, resultPath: 'valid' })] },
    });
    expect(s).toMatchObject({ total: 16, max: 20, percent: 80, pending: 0 });
    const noGrade = scoreSheet({ questions: [islem(), q2] }, {
      read: { isBackSide: false, studentName: 'Elif', nameConfidence: 'high', unreadable: false, answers: [solved, { ...answer('x'), q: 2 }] },
      override: {}, grade: null,
    });
    expect(noGrade.pending).toBe(2);
  });
});
