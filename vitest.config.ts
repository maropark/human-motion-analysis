import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/analysis/**/*.test.ts'],
    environment: 'node',
  },
});
