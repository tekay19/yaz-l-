import { createClaudeReader, graderModel, type Effort, type Reader } from './claude';
import { createOpenAIReader, openaiModel } from './openai';

// GRADER_PROVIDER picks the model vendor: "anthropic" (default) or "openai".
const provider = () => (process.env.GRADER_PROVIDER === 'openai' ? 'openai' : 'anthropic');

export function createReader(opts: { effort?: Effort } = {}): Reader {
  return provider() === 'openai' ? createOpenAIReader(undefined, opts) : createClaudeReader(undefined, opts);
}

export const readerModel = () => (provider() === 'openai' ? openaiModel() : graderModel());
