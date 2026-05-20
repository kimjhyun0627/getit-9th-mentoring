import { defineConfig } from 'vitest/config';

/**
 * auth-utils 는 server.js (jsonwebtoken / Node) + client.js (브라우저 axios/fetch) 둘 다 다룬다.
 * client.test.js 가 window 접근하므로 jsdom 환경 필요.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
