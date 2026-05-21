import { useEffect, useState } from 'react';

/**
 * 현재 document 가 visible (활성 탭) 인지 추적하는 훅 — #436.
 *
 * SSR/JSDOM 안전: `document` 가 없으면 항상 true 로 fallback (폴링 그대로 진행).
 * visibilitychange 이벤트로 토글. 활성 탭 1개당 60s 폴링이 N탭이면 N배 비용이라
 * 백그라운드 시 명시적 폴링 중지에 사용.
 *
 * react-query 의 `refetchIntervalInBackground` 기본 false 라 일부 절약은 되지만,
 * tab 활성 여부와 별개로 "다른 모니터의 다른 탭" 같은 케이스는 hidden 으로 보고됨.
 * 이 훅의 결과를 `refetchInterval` 에 함수 형태로 넣으면 hidden 시 0 → 폴링 일시정지.
 *
 * @returns {boolean} document.hidden 의 역. true = 활성.
 */
export const useDocumentVisible = () => {
  const initial =
    typeof document === 'undefined' || typeof document.hidden !== 'boolean'
      ? true
      : !document.hidden;
  const [visible, setVisible] = useState(initial);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handler = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return visible;
};
