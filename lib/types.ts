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

export type PageResult =
  | { type: 'key'; read: KeyRead }
  | { type: 'student'; read: StudentRead };

export type PageOverride = {
  studentName?: string;
  answers?: { q: number; marked: Option[] }[];
};
