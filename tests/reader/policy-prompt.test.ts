import { describe, expect, it } from 'vitest';
import { gradeUser } from '@/lib/reader/klasik-prompts';
import { RubricInput } from '@/lib/klasik/rubric';
import type { RubricQuestion } from '@/lib/types';

const q = (formRequired?: boolean): RubricQuestion => ({
  q: 4, rev: 1, type: 'islem', prompt: 'A ∩ B kümesini aralık gösterimi ile yazınız.', answer: '[800, 1200]',
  criteria: [{ id: 'c1', text: 'Sonuç [800, 1200]', points: 10, role: 'result', required: false }],
  accepted: [], policy: { workRequired: false, carryForward: true, wrongInfoPenalty: false, style: 'balanced', ...(formRequired === undefined ? {} : { formRequired }) },
});
const answer = { q: 4, lines: [{ text: '800 ≤ x ≤ 1200', crossed: false }], unclear: false, hasFigure: false };

describe('the "result in the asked form" setting', () => {
  it('reaches the grader, off unless the teacher turns it on', () => {
    expect(gradeUser([q()], [answer], false)).toContain('formRequired=false');
    expect(gradeUser([q(true)], [answer], false)).toContain('formRequired=true');
  });
  it('is kept by the rubric schema, and older rubrics without it still load', () => {
    expect(RubricInput.parse({ questions: [q(true)] }).questions[0].policy.formRequired).toBe(true);
    expect(RubricInput.parse({ questions: [q()] }).questions[0].policy.formRequired).toBeUndefined();
  });
});

describe("the teacher's note", () => {
  it('reaches reading, drafting and grading, and is left out when empty', async () => {
    const { buildReader } = await import('@/lib/reader/types');
    const seen: string[] = [];
    const reader = buildReader(async (_system, parts) => {
      seen.push(parts.map((p) => ('text' in p ? p.text : '')).join(''));
      return { read: {} as never, usage: { inputTokens: 0, outputTokens: 0 } };
    });
    const note = 'Cevaplar kâğıdın arkasında devam edebilir.';
    await reader.readKlasik(Buffer.from(''), note);
    await reader.draftRubric({ keyText: '1) x = 4', maxPoints: [10], note });
    await reader.gradeKlasik({ questions: [q()], answers: [answer], images: [], note });
    await reader.gradeKlasik({ questions: [q()], answers: [answer], images: [], note: '  ' });
    expect(seen.slice(0, 3).every((t) => t.includes(note))).toBe(true);
    expect(seen[3]).not.toContain("teacher's notes");
  });
});
