import { useEffect } from 'react';

/**
 * #464 — 모달 open 시 body scroll lock + 배경 inert 토글.
 *
 * 동작:
 *  - `document.body.style.overflow = 'hidden'` 적용/복원
 *  - root 의 sibling element 들 중 `data-app-root="true"` 또는 `#root` 자식들에
 *    `inert` 토글 → VoiceOver swipe / Tab focus 모두 배경 차단.
 *  - 다중 모달 동시 open 케이스 — 모듈 단위 counter 로 안전 복원.
 *
 * WAI-ARIA dialog 패턴 권장: body scroll lock + 배경 inert.
 *
 * @param {boolean} open
 */
let lockCount = 0;
let savedOverflow = '';

export const useBodyScrollLock = (open) => {
  useEffect(() => {
    if (!open) return undefined;

    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;

    const root = document.getElementById('root');
    if (root) root.setAttribute('inert', '');

    return () => {
      lockCount -= 1;
      if (lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = savedOverflow;
        if (root) root.removeAttribute('inert');
      }
    };
  }, [open]);
};
