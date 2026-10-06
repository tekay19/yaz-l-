import { createClaudeReader, graderModel } from './claude';
import type { Effort, Reader } from './types';
import { createOpenAIReader, openaiModel } from './openai';
import { createGeminiReader, geminiModel } from './gemini';

// GRADER_PROVIDER picks the model vendor: "anthropic" (default), "openai" or "gemini".
const provider = () => {
  const p = process.env.GRADER_PROVIDER;
  return p === 'openai' || p === 'gemini' ? p : 'anthropic';
};

export function createReader(opts: { effort?: Effort } = {}): Reader {
  const p = provider();
  if (p === 'openai') return createOpenAIReader(undefined, opts);
  if (p === 'gemini') return createGeminiReader(undefined, opts);
  return createClaudeReader(undefined, opts);
}

export const readerModel = () => {
  const p = provider();
  return p === 'openai' ? openaiModel() : p === 'gemini' ? geminiModel() : graderModel();
};
