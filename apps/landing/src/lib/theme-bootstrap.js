/**
 * 무플래시 다크 부트스트랩 — system 선호도 존중 (#414).
 *
 * `apps/landing/index.html` <head> 의 inline 스크립트와 **동일 로직**.
 * inline 은 모듈 import 불가라 vitest 로 직접 테스트 못 함 → 동일 로직을
 * pure 함수로 추출해 4 경로 (saved=light / dark / system / null) 단위 테스트.
 *
 * index.html 인라인 스크립트를 수정할 때는 **이 파일도 함께** 갱신.
 * (이 파일은 React 런타임이 아닌 부트스트랩 로직의 spec 역할.)
 *
 * 로직:
 *   - localStorage `getit:theme` 가 'dark' → dark
 *   - 'light' → light
 *   - 'system' 또는 없음 → matchMedia('(prefers-color-scheme: dark)')
 *   - matchMedia 미지원 / 예외 → dark fallback (Tech-Dark 기본)
 *
 * @typedef {{ getItem: (key: string) => string | null }} StorageLike
 * @typedef {{ matchMedia?: (query: string) => { matches: boolean } }} WindowLike
 *
 * @param {{ storage?: StorageLike | null, window?: WindowLike | null }} [deps]
 * @returns {'dark' | 'light'}
 */
export const resolveBootstrapTheme = ({ storage, window: win } = {}) => {
  try {
    const saved = storage ? storage.getItem('getit:theme') : null;
    if (saved === 'dark') return 'dark';
    if (saved === 'light') return 'light';
    // saved === 'system' 또는 null/undefined → matchMedia 분기
    const mq =
      win && typeof win.matchMedia === 'function'
        ? win.matchMedia('(prefers-color-scheme: dark)')
        : null;
    if (mq && typeof mq.matches === 'boolean') {
      return mq.matches ? 'dark' : 'light';
    }
    // matchMedia 미지원 (SSR / 매우 오래된 브라우저) → 다크 fallback
    return 'dark';
  } catch {
    return 'dark';
  }
};
