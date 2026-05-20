import { execSync } from 'node:child_process';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Fallback (`unknown` 5건) — CI shallow clone 또는 git 미실행 시. */
const FALLBACK = [
  { sha: 'unknown', message: 'build context unavailable' },
  { sha: 'unknown', message: '— git metadata not injected' },
  { sha: 'unknown', message: '— see ci build logs' },
  { sha: 'unknown', message: '— fallback placeholder' },
  { sha: 'unknown', message: '— fallback placeholder' },
];

/**
 * 빌드타임에 실제 git log 5건을 주입 (#233).
 * - `define`으로 `__GIT_LOG__` 전역 상수를 박음.
 * - Footer는 `src/data/git-log.js`의 `getGitLog()`로 `__GIT_LOG__`를 참조.
 * - CI shallow clone (fetch-depth=1) 등으로 commit 수가 5 미만이면 fallback으로 패딩.
 * - `.git`이 없거나 git 실행 실패 시 전부 fallback.
 *
 * @returns {{ sha: string; message: string }[]} 정확히 5건.
 */
const readGitLog = () => {
  let entries = [];
  try {
    const raw = execSync('git log --pretty=format:%h%x09%s -n 5', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (raw) {
      entries = raw.split('\n').map((line) => {
        const [sha, ...rest] = line.split('\t');
        return { sha: sha.slice(0, 7), message: rest.join('\t') };
      });
    }
  } catch {
    // git 미사용 환경
  }
  // 5건 미만이면 fallback으로 패딩
  while (entries.length < 5) {
    entries.push(FALLBACK[entries.length]);
  }
  return entries.slice(0, 5);
};

/**
 * Vite + Vitest 통합 config.
 * Docker 환경에서도 외부 접근 가능하도록 host: true.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    __GIT_LOG__: JSON.stringify(readGitLog()),
  },
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
