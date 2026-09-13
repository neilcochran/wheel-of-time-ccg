import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The Node surfaces and the browser app need different environments, so
    // each is its own project. The app's settings live in its vite.config.ts.
    projects: [
      'apps/*',
      {
        test: {
          name: 'node',
          include: ['packages/*/src/**/*.test.ts', 'tools/*/src/**/*.test.ts'],
        },
      },
    ],
  },
});
