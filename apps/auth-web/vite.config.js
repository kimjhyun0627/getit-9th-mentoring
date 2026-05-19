import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite + Vitest 통합 config (landing 패턴과 동일).
 * auth-web은 dev에서 별도 포트(5174)로 띄워 landing(5173)과 충돌 회피.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: false,
  },
});
