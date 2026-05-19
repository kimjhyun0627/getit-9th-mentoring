import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite + Vitest 통합 config.
 * Docker 환경에서도 외부 접근 가능하도록 host: true.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: false,
  },
});
