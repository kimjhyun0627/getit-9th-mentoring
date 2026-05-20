import { execSync } from 'node:child_process';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * 빌드타임에 실제 git log 5건을 주입 (#233).
 * - CI에서 `.git`이 없거나 git 실행 실패 시 fallback 더미 5건 반환.
 * - Footer는 `import.meta.env.VITE_GIT_LOG` (JSON string) 를 파싱해서 사용.
 *
 * @returns {{ sha: string; message: string }[]}
 */
const readGitLog = () => {
  try {
    const raw = execSync('git log --pretty=format:%h%x09%s -n 5', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (!raw) throw new Error('empty git log');
    return raw.split('\n').map((line) => {
      const [sha, ...rest] = line.split('\t');
      return { sha: sha.slice(0, 7), message: rest.join('\t') };
    });
  } catch {
    // 빌드 컨텍스트에 git 없을 때 fallback
    return [
      { sha: 'unknown', message: 'build context unavailable' },
      { sha: 'unknown', message: '— git metadata not injected' },
      { sha: 'unknown', message: '— see ci build logs' },
      { sha: 'unknown', message: '— fallback placeholder' },
      { sha: 'unknown', message: '— fallback placeholder' },
    ];
  }
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
