import { useCallback, useEffect, useRef } from 'react';

/**
 * IntersectionObserver 기반 sentinel hook — 무한 스크롤 공통 추상화 (#525).
 *
 * 사용 패턴:
 *   const setSentinel = useInfiniteScroll({
 *     onIntersect: () => fetchNextPage(),
 *     enabled: hasNextPage && !isFetchingNextPage,
 *   });
 *   ...
 *   <div ref={setSentinel} />
 *
 * 디자인:
 *  - ref callback 형태로 반환 — 같은 sentinel DOM 노드를 React 가 mount/unmount 할 때마다
 *    observer 를 안전히 재바인딩. useRef + useEffect 조합은 노드가 조건부 렌더 될 때 stale.
 *  - rootMargin '200px' — 화면 아래로 200px 남기고 미리 fetch. 빠른 스크롤에서도 끊김 최소.
 *  - enabled=false 면 observer 자체를 disconnect (네트워크 idle 시 폭주 가드).
 *  - jsdom 에서 IntersectionObserver 없으면 no-op (테스트 환경 호환).
 *
 * @param {{
 *   onIntersect: () => void;
 *   enabled?: boolean;
 *   rootMargin?: string;
 * }} opts
 * @returns {(node: Element | null) => void}
 */
export const useInfiniteScroll = ({ onIntersect, enabled = true, rootMargin = '200px' }) => {
  // onIntersect 가 매 렌더 새 함수여도 observer 재생성 없이 최신 호출.
  const cbRef = useRef(onIntersect);
  useEffect(() => {
    cbRef.current = onIntersect;
  }, [onIntersect]);

  const observerRef = useRef(/** @type {IntersectionObserver | null} */ (null));

  const observe = useCallback(
    /** @param {Element | null} node */
    (node) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node || !enabled) return;
      if (typeof IntersectionObserver === 'undefined') return;
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              cbRef.current();
              break;
            }
          }
        },
        { rootMargin },
      );
      obs.observe(node);
      observerRef.current = obs;
    },
    [enabled, rootMargin],
  );

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    [],
  );

  return observe;
};
