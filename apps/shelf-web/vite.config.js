import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite + Vitest config — shelf-web.
 * dev 포트 5175 (auth-web 5174, landing 5173과 충돌 회피).
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
