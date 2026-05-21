import { useEffect } from 'react';

/**
 * #464 — 모달 open 시 body scroll lock + 배경 inert 토글.
 *
 * 핵심:
 *  - `document.body.style.overflow = 'hidden'` 적용/복원
 *  - dialogRef 가 가리키는 dialog 의 모든 ancestor 의 sibling 형제들에 `inert` 토글.
 *    → 모달 트리 안쪽은 그대로 사용 가능, 바깥쪽 (BoardPage 등) 만 차단.
 *    (CR feedback: 단순히 `#root` 에 inert 걸면 모달 자체도 #root 자손이라 같이 막힘.)
 *  - 다중 모달 동시 open 가능성 — 모듈 단위 counter 로 안전 복원.
 *
 * WAI-ARIA dialog 패턴: body scroll lock + 배경 inert (focus, click, SR 모두 차단).
 *
 * @param {boolean} open
 * @param {{ current: HTMLElement | null }} [dialogRef] - 모달 root 요소 ref
 */
let lockCount = 0;
let savedOverflow = '';

/** @type {Element[]} */
let inertedNodes = [];

/**
 * CR(#494) — dialogEl 의 *부모* (overlay 컨테이너) 부터 ancestor chain 따라
 *   sibling 형제만 inert. dialogEl 자신의 형제는 backdrop button 일 수 있어
 *   skip (그 형제 inert 면 backdrop 클릭 닫기가 죽음).
 *
 *   구조: body > #root > … > <div fixed inset-0>     ← overlay (dialogEl 의 부모)
 *                                ├ button backdrop   ← dialog 의 형제, inert 금지
 *                                └ div role=dialog   ← dialogEl
 *
 *   overlay 의 형제부터 body 까지 ancestor 의 형제들에만 inert 토글.
 */
const markBackgroundInert = (dialogEl) => {
  /** @type {Element[]} */
  const nodes = [];
  // 첫 cursor 는 dialogEl 의 부모 (overlay container). 그 형제부터 inert 시작.
  let cursor = dialogEl.parentElement;
  while (cursor && cursor !== document.body && cursor.parentElement) {
    const parent = cursor.parentElement;
    for (const sibling of parent.children) {
      if (sibling !== cursor && !sibling.hasAttribute('inert')) {
        sibling.setAttribute('inert', '');
        nodes.push(sibling);
      }
    }
    cursor = parent;
  }
  return nodes;
};

export const useBodyScrollLock = (open, dialogRef) => {
  useEffect(() => {
    if (!open) return undefined;

    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const el = dialogRef?.current;
      if (el) inertedNodes = markBackgroundInert(el);
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = savedOverflow;
        for (const node of inertedNodes) node.removeAttribute('inert');
        inertedNodes = [];
      }
    };
  }, [open, dialogRef]);
};
