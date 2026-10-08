import { afterEach, describe, expect, it } from 'vitest';
import { createClaudeReader, type MessagesClient } from '@/lib/reader/claude';
import { createOpenAIReader, type ResponsesClient } from '@/lib/reader/openai';
import { gradeUser } from '@/lib/reader/klasik-prompts';
import type { KlasikAnswer, RubricQuestion } from '@/lib/types';

const claudeReply = (json: unknown) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 900, output_tokens: 120 } });
const openaiReply = (json: unknown) => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(json) }] }], usage: { input_tokens: 900, output_tokens: 120 } });

function claudeClient(responses: unknown[]): MessagesClient & { calls: any[] } {
  const calls: any[] = [];
  return { calls, beta: { messages: { create: async (p: any) => { calls.push(p); return responses.shift() as any; } } } };
}
function openaiClient(responses: unknown[]): ResponsesClient & { calls: any[] } {
  const calls: any[] = [];
  return { calls, responses: { create: async (p: any) => { calls.push(p); return responses.shift() as any; } } };
}

const page = { isBackSide: false, studentName: 'Elif', nameConfidence: 'high', unreadable: false,
  answers: [{ q: 1, lines: [{ text: '2x = 8', crossed: false }], unclear: false, hasFigure: false }] };
const draft = { questions: [{ q: 1, type: 'islem', prompt: null, answer: 'x = 4', workRequired: true, accepted: [],
  criteria: [{ text: 'Sonuç', points: 1, role: 'result', required: false }] }] };
const grade = { questions: [{ q: 1, criteria: [{ id: 'c1', verdict: 'met', evidence: 'x = 4', slipOnly: false }], resultCorrect: true, resultPath: 'valid',
  firstError: null, errorKind: null, flags: [], confidence: 'high', note: 'Doğru.' }] };

const rq: RubricQuestion = {
  q: 1, rev: 1, type: 'islem', prompt: '2x + 3 = 11', answer: 'x = 4',
  criteria: [{ id: 'c1', text: 'Sonuç doğru', points: 4, role: 'result', required: false }, { id: 'c2', text: 'Kavram', points: 1, role: 'other', required: true }],
  accepted: [{ text: 'Yok etme yöntemi', example: null, by: 'ai' }, { text: 'Kâğıt 3', example: 'x = (11-3)/2', by: 'teacher' }],
  policy: { workRequired: true, carryForward: true, wrongInfoPenalty: false },
};
const answer: KlasikAnswer = { q: 1, lines: [{ text: '2x = 14', crossed: true }, { text: 'x = 4', crossed: false }], unclear: false, hasFigure: false };

describe('klasik reader (Claude)', () => {
  afterEach(() => { delete process.env.KLASIK_READ_EFFORT; delete process.env.KLASIK_GRADE_EFFORT; });

  it('copies a page from its photo at the reading effort', async () => {
    process.env.KLASIK_READ_EFFORT = 'low';
    const client = claudeClient([claudeReply(page)]);
    const out = await createClaudeReader(client).readKlasik(Buffer.from('jpg'));
    expect(out.read.answers[0].lines[0].text).toBe('2x = 8');
    const sent = client.calls[0];
    expect(sent.messages[0].content.map((c: any) => c.type)).toEqual(['image', 'text']);
    expect(sent.output_config.effort).toBe('low');
    expect(sent.system[0].text).toMatch(/Never correct anything/);
  });

  it('drafts a rubric from text alone, with the teacher\'s maxima', async () => {
    const client = claudeClient([claudeReply(draft)]);
    const out = await createClaudeReader(client).draftRubric({ keyText: '1) x = 4', maxPoints: [10, 5] });
    expect(out.read.questions[0].type).toBe('islem');
    const content = client.calls[0].messages[0].content;
    expect(content.map((c: any) => c.type)).toEqual(['text']);
    expect(content[0].text).toContain('1: 10, 2: 5');
  });

  it('grades from the transcription, adding the photo only when asked', async () => {
    process.env.KLASIK_GRADE_EFFORT = 'high';
    const client = claudeClient([claudeReply(grade), claudeReply(grade)]);
    const reader = createClaudeReader(client);
    await reader.gradeKlasik({ questions: [rq], answers: [answer], images: [] });
    await reader.gradeKlasik({ questions: [rq], answers: [answer], images: [Buffer.from('jpg')] });
    expect(client.calls[0].messages[0].content.map((c: any) => c.type)).toEqual(['text']);
    expect(client.calls[1].messages[0].content.map((c: any) => c.type)).toEqual(['image', 'text']);
    expect(client.calls[0].output_config.effort).toBe('high');
    expect(client.calls[0].system[0].text).toMatch(/never how similar it is to the key/);
  });

  it('rejects a grade that breaks the schema', async () => {
    const bad = { questions: [{ ...grade.questions[0], flags: ['made_up_flag'] }] };
    await expect(createClaudeReader(claudeClient([claudeReply(bad)])).gradeKlasik({ questions: [rq], answers: [answer], images: [] })).rejects.toThrow();
  });
});

describe('klasik reader (OpenAI)', () => {
  it('sends the same three steps through the Responses API with strict schemas', async () => {
    const client = openaiClient([openaiReply(page), openaiReply(draft), openaiReply(grade)]);
    const reader = createOpenAIReader(client);
    await reader.readKlasik(Buffer.from('jpg'));
    await reader.draftRubric({ keyText: 'k', maxPoints: [] });
    await reader.gradeKlasik({ questions: [rq], answers: [answer], images: [] });
    expect(client.calls.map((c) => c.text.format.name)).toEqual(['klasik_page', 'klasik_rubric', 'klasik_grade']);
    expect(client.calls.every((c) => c.text.format.strict === true)).toBe(true);
    expect(client.calls[0].input[0].content[0].type).toBe('input_image');
    expect(client.calls[2].input[0].content.map((c: any) => c.type)).toEqual(['input_text']);
  });
});

describe('gradeUser', () => {
  it('shows the rubric, the accepted answers and the crossed-out lines', () => {
    const text = gradeUser([rq], [answer], false);
    expect(text).toContain('## Question 1 (type: islem, 5 points)');
    expect(text).toContain('workRequired=true, carryForward=true');
    expect(text).toContain('- c1 (4 points, result): Sonuç doğru');
    expect(text).toContain('- c2 (1 points, exact term required): Kavram');
    expect(text).toContain('- Yok etme yöntemi');
    expect(text).toContain('accepted this answer as fully correct (Kâğıt 3)');
    expect(text).toContain('1. (crossed out) 2x = 14');
    expect(text).toContain('2. x = 4');
    expect(text).not.toContain('photo of the sheet');
    expect(gradeUser([rq], [], true)).toContain('(no answer)');
    expect(text).not.toContain('scored these answers');
  });

  it('shows the answers the teacher scored by hand as the standard to follow', () => {
    const text = gradeUser([{ ...rq, scored: [{ text: 'x = 4 buldum', points: 2 }, { text: 'bilmiyorum', points: 0 }] }], [answer], false);
    expect(text).toContain('The teacher scored these answers to this question by hand');
    expect(text).toContain('- 2 of 5 points:\n"""\nx = 4 buldum');
    expect(text).toContain('- 0 of 5 points:\n"""\nbilmiyorum');
  });
});
