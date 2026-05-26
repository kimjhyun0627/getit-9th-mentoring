import { defineConfig } from 'vitest/config';

/**
 * env-validator — pure JS, Node 환경만. jsdom 불필요.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
});
