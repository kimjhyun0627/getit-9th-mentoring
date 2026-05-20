/**
 * 빌드타임에 vite.config.js의 `define` 으로 주입된 git log 5건 (#233).
 *
 * 주입 형식:
 *   __GIT_LOG__ = [{ sha: '3f9c1a2', message: 'feat(...)' }, ...]
 *
 * dev/test 환경에서 주입이 안 됐을 때를 위한 안전한 fallback (5건 더미).
 *
 * @type {{ sha: string; message: string }[]}
 */
const FALLBACK_GIT_LOG = [
  { sha: 'aaaaaaa', message: 'chore: dev fallback — git log not injected' },
  { sha: 'bbbbbbb', message: 'chore: run `vite build` to inject real history' },
  { sha: 'ccccccc', message: 'chore: dev fallback line 3' },
  { sha: 'ddddddd', message: 'chore: dev fallback line 4' },
  { sha: 'eeeeeee', message: 'chore: dev fallback line 5' },
];

/**
 * Footer가 사용할 git log 5건.
 * `define`이 안 박혔거나 비어 있으면 fallback 반환.
 *
 * @returns {{ sha: string; message: string }[]}
 */
export const getGitLog = () => {
  try {
    // eslint-disable-next-line no-undef
    const injected = typeof __GIT_LOG__ !== 'undefined' ? __GIT_LOG__ : null;
    if (Array.isArray(injected) && injected.length > 0) {
      return injected.slice(0, 5);
    }
  } catch {
    // ignore
  }
  return FALLBACK_GIT_LOG;
};
