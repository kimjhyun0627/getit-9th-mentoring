import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite + Vitest config (auth-web 패턴).
 * shelf-web은 5175 포트 — landing(5173) / auth-web(5174) 와 충돌 회피.
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
