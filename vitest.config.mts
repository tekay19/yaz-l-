import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: { environment: 'node', testTimeout: 30_000, include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
