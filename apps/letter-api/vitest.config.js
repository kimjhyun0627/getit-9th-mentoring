import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.js'],
    // 단일 워커 — 동일 모듈 mock 상태가 테스트 간 공유되어도 setup.js의 reset()으로 처리
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
