import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite + Vitest 통합 config (auth-web 패턴 동일).
 * hobby-web은 dev에서 별도 포트(5175)로 띄워 landing(5173)/auth-web(5174)과 충돌 회피.
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
