// Settings shared by both readers (Claude and OpenAI).

// A model call must give up before the queue's 5-minute lease runs out, or a
// second worker picks the page up while the first is still waiting. The SDKs'
// own retries are off for the same reason: the queue retries with backoff.
export const readerTimeoutMs = () => Number(process.env.READER_TIMEOUT_MS || 240_000);
export const clientOptions = () => ({ timeout: readerTimeoutMs(), maxRetries: 0 });
