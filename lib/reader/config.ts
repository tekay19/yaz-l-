// Settings shared by both readers (Claude and OpenAI).

export type Effort = 'low' | 'medium' | 'high';

// A model call must give up before the queue's 5-minute lease runs out, or a
// second worker picks the page up while the first is still waiting. The SDKs'
// own retries are off for the same reason: the queue retries with backoff.
export const readerTimeoutMs = () => Number(process.env.READER_TIMEOUT_MS || 240_000);
export const clientOptions = () => ({ timeout: readerTimeoutMs(), maxRetries: 0 });

// GRADER_EFFORT sets every call; the klasik steps can be tuned on their own:
// copying handwriting down and judging it against a rubric differ in how much
// reasoning pays off.
export type CallKind = 'optik' | 'klasik-read' | 'klasik-grade';
export function effortFor(kind: CallKind): Effort {
  const specific = kind === 'klasik-read' ? process.env.KLASIK_READ_EFFORT
    : kind === 'klasik-grade' ? process.env.KLASIK_GRADE_EFFORT : undefined;
  return (specific || process.env.GRADER_EFFORT || 'medium') as Effort;
}
