// The vocabulary every layer shares: what the reader saw on a page, and
// what the teacher corrected afterwards. The reader never scores anything.

export type Option = 'A' | 'B' | 'C' | 'D' | 'E';
export const OPTIONS: readonly Option[] = ['A', 'B', 'C', 'D', 'E'];
export type Confidence = 'high' | 'low';

export type KeyRead = {
  questionCount: number;
  answers: { q: number; option: Option | null }[];
};

export type StudentRead = {
  isBackSide: boolean;
  studentName: string | null;
  nameConfidence: Confidence;
  unreadable: boolean;
  answers: { q: number; marked: Option[]; confidence: Confidence }[];
};

// ── Klasik (open-ended) exams ─────────────────────────────────────────────
// A klasik page is first copied down literally (KlasikRead), then graded
// against the rubric the teacher approved (QuestionGrade). The copy never
// sees the key, and the grade never carries points: code computes them.

export type KlasikLine = { text: string; crossed: boolean };
// altText: a second reader's different reading of the answer (cross-read)
export type KlasikAnswer = { q: number; lines: KlasikLine[]; unclear: boolean; hasFigure: boolean; altText?: string };
export type KlasikRead = {
  isBackSide: boolean;
  studentName: string | null;
  nameConfidence: Confidence;
  unreadable: boolean;
  answers: KlasikAnswer[];
};

export type QuestionType = 'islem' | 'kisa' | 'yorum';
export type Criterion = { id: string; text: string; points: number; role: 'result' | 'other'; required: boolean };
export type AcceptedPath = { text: string; example: string | null; by: 'ai' | 'teacher' };
// How generously answers are judged, set by the teacher for the exam:
// strict — only a precise, complete idea is met; balanced — the default;
// lenient — a relevant answer that shows some correct understanding gets
// partial credit. Never credit for wrong, empty or off-topic answers.
export const GRADING_STYLES = ['strict', 'balanced', 'lenient'] as const;
export type GradingStyle = (typeof GRADING_STYLES)[number];
export type QuestionPolicy = { workRequired: boolean; carryForward: boolean; wrongInfoPenalty: boolean; style?: GradingStyle };
export type RubricQuestion = {
  q: number;
  rev: number; // bumped when the question changes after approval: its grades go stale
  type: QuestionType;
  prompt: string | null;
  answer: string;
  criteria: Criterion[]; // the question is worth the sum of its criteria
  accepted: AcceptedPath[];
  policy: QuestionPolicy;
};
export type Rubric = { questions: RubricQuestion[] };

export const KLASIK_FLAGS = [
  'alternative_path', 'alternative_answer', 'invalid_path', 'compensating_errors', 'unsupported_result', 'unclear_reading',
  'wrong_info', 'keywords_only', 'wrong_justification', 'off_topic', 'instruction_in_answer',
] as const;
export type KlasikFlag = (typeof KLASIK_FLAGS)[number];
export type Verdict = 'met' | 'partial' | 'not_met';
export type ResultPath = 'valid' | 'invalid' | 'unsupported' | 'none';

export type QuestionGrade = {
  q: number;
  rev: number; // the rubric question revision this grade was made against
  // slipOnly: the criterion's step is right but for an arithmetic slip
  criteria: { id: string; verdict: Verdict; evidence: string; slipOnly?: boolean }[];
  resultCorrect: boolean | null;
  resultPath: ResultPath | null;
  firstError: string | null;
  errorKind: 'islem' | 'yontem' | null;
  flags: KlasikFlag[];
  confidence: Confidence;
  note: string;
  failed: boolean; // grading gave up; the teacher enters the points
  textOnly: boolean; // a figure question graded without its photo
};
export type KlasikGrade = { questions: QuestionGrade[] };

export type PageResult =
  | { type: 'key'; read: KeyRead }
  | { type: 'student'; read: StudentRead }
  | { type: 'klasik-key'; read: KlasikRead }
  | { type: 'klasik-student'; read: KlasikRead };

export type PageOverride = {
  studentName?: string;
  answers?: { q: number; marked: Option[] }[]; // optik student sheet
  key?: { q: number; option: Option | null }[]; // optik key page; null = the teacher confirms "no key"
  points?: { q: number; points: number }[]; // klasik: the teacher's final points for a question
  texts?: { q: number; text: string }[]; // klasik: the teacher's fix of the transcription
};
