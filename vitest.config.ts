import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'tools/*/src/**/*.test.ts'],
    // No tests exist yet. Remove this once the first one lands, so an empty
    // run starts failing instead of quietly passing.
    passWithNoTests: true,
  },
});
