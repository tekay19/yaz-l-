import type { z } from 'zod';
import type { KeyRead, KlasikAnswer, KlasikRead, RubricQuestion, StudentRead } from '@/lib/types';
import {
  GradeOutputSchema, KeyReadSchema, KlasikReadSchema, RosterReadSchema, RubricDraftSchema, StudentReadSchema,
  type GradeOutput, type RubricDraft,
} from './schemas';
import { KEY_SYSTEM, KEY_USER, STUDENT_SYSTEM, studentUser } from './prompts';
import { GRADE_SYSTEM, KLASIK_READ_SYSTEM, KLASIK_READ_USER, KLASIK_KEY_USER, ROSTER_SYSTEM, ROSTER_USER, RUBRIC_SYSTEM, gradeUser, rubricUser, teacherNote } from './klasik-prompts';
import { effortFor, type CallKind, type Effort } from './config';

export type { Effort } from './config';
export type Usage = { inputTokens: number; outputTokens: number };
export type Reader = {
  readKey(image: Buffer): Promise<{ read: KeyRead; usage: Usage }>;
  readStudent(image: Buffer, questionCount: number): Promise<{ read: StudentRead; usage: Usage }>;
  // klasik: copy a page down, draft a rubric from the key, judge answers;
  // `note` is the teacher's own note on the exam, if any
  readKlasik(image: Buffer, note?: string): Promise<{ read: KlasikRead; usage: Usage }>;
  // the teacher's key: also keeps each printed question and its points
  readKlasikKey?(image: Buffer, note?: string): Promise<{ read: KlasikRead; usage: Usage }>;
  // a photographed class list: the students' names
  readRoster?(image: Buffer): Promise<{ read: { names: string[] }; usage: Usage }>;
  draftRubric(input: { keyText: string; maxPoints: number[]; note?: string }): Promise<{ read: RubricDraft; usage: Usage }>;
  gradeKlasik(input: { questions: RubricQuestion[]; answers: KlasikAnswer[]; images: Buffer[]; note?: string }): Promise<{ read: GradeOutput; usage: Usage }>;
  // ESCALATE_*: a stronger model, asked again only where this one was unsure
  expert?: Reader;
};
export class ReadRefused extends Error {}
// The answer hit the output limit and its JSON is cut off; asking again with
// the same input ends the same way.
export class OutputTruncated extends Error {}

// What goes in the user turn: photos first, then the text that asks about them.
export type Part = { image: Buffer } | { text: string };

// One structured call to a provider; `name` labels the output schema.
export type Ask = <T>(system: string, parts: Part[], schema: z.ZodType<T>, name: string, effort: Effort) =>
  Promise<{ read: T; usage: Usage }>;

// The five calls, the same for every provider: only the transport differs.
// opts.effort overrides the environment, so the measurement screen can
// compare effort levels on the same sheets without restarting the server.
export function buildReader(ask: Ask, opts: { effort?: Effort } = {}): Reader {
  const effort = (kind: CallKind) => opts.effort ?? effortFor(kind);
  return {
    readKey: (image) => ask(KEY_SYSTEM, [{ image }, { text: KEY_USER }], KeyReadSchema, 'answer_key', effort('optik')),
    readStudent: (image, questionCount) =>
      ask(STUDENT_SYSTEM, [{ image }, { text: studentUser(questionCount) }], StudentReadSchema, 'student_sheet', effort('optik')),
    readKlasik: (image, note) =>
      ask(KLASIK_READ_SYSTEM, [{ image }, { text: KLASIK_READ_USER + teacherNote(note) }], KlasikReadSchema, 'klasik_page', effort('klasik-read')),
    readRoster: (image) => ask(ROSTER_SYSTEM, [{ image }, { text: ROSTER_USER }], RosterReadSchema, 'class_list', effort('optik')),
    readKlasikKey: (image, note) =>
      ask(KLASIK_READ_SYSTEM, [{ image }, { text: KLASIK_KEY_USER + teacherNote(note) }], KlasikReadSchema, 'klasik_key', effort('klasik-read')),
    draftRubric: ({ keyText, maxPoints, note }) =>
      ask(RUBRIC_SYSTEM, [{ text: rubricUser(keyText, maxPoints) + teacherNote(note) }], RubricDraftSchema, 'klasik_rubric', effort('klasik-grade')),
    gradeKlasik: ({ questions, answers, images, note }) =>
      ask(GRADE_SYSTEM, [...images.map((image) => ({ image })), { text: gradeUser(questions, answers, images.length > 0) + teacherNote(note) }],
        GradeOutputSchema, 'klasik_grade', effort('klasik-grade')),
  };
}
