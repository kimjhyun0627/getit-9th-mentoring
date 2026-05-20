import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite + Vitest 통합 config (auth-web 패턴과 동일).
 * board-web 은 dev에서 5175 포트로 띄워 landing(5173)/auth-web(5174)와 충돌 회피.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: false,
  },
});
