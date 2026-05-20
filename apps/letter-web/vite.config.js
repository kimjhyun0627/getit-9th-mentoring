import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite + Vitest 통합 config.
 * letter-web 은 dev 에서 5177 포트.
 * (landing 5173 / auth-web 5174 / hobby-web 5175 / shelf-web 5176 충돌 회피)
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    host: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: false,
  },
});
