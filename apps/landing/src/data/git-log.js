/**
 * 빌드타임에 vite.config.js의 `define` 으로 주입된 git log 5건 (#233).
 *
 * 주입 형식:
 *   __GIT_LOG__ = [{ sha: '3f9c1a2', message: 'feat(...)' }, ...]
 *
 * dev/test 환경에서 주입이 안 됐을 때를 위한 안전한 fallback (5건 더미).
 * 또한 주입된 배열이 5건 미만(CI shallow clone 등)일 때도 fallback으로 패딩.
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
 * Footer가 사용할 git log 5건 (항상 정확히 5건 반환).
 * `define`이 안 박혔거나 비어 있으면 fallback 반환.
 * 주입된 배열이 5건 미만이면 fallback으로 패딩.
 *
 * @returns {{ sha: string; message: string }[]}
 */
export const getGitLog = () => {
  let injected = null;
  try {
    // eslint-disable-next-line no-undef
    injected = typeof __GIT_LOG__ !== 'undefined' ? __GIT_LOG__ : null;
  } catch {
    injected = null;
  }
  if (!Array.isArray(injected) || injected.length === 0) {
    return FALLBACK_GIT_LOG;
  }
  const out = injected.slice(0, 5);
  while (out.length < 5) {
    out.push(FALLBACK_GIT_LOG[out.length]);
  }
  return out;
};
