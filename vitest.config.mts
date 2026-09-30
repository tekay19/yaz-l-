import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // hooks build a fresh PGlite database too; under a full parallel run that can
  // take longer than the 10 s hook default, so they get the tests' own budget
  test: { environment: 'node', testTimeout: 30_000, hookTimeout: 30_000, include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
