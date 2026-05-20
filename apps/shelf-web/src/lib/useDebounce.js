import { useEffect, useState } from 'react';

/**
 * 값 debounce 훅. `delay` ms 동안 값이 변하지 않으면 반영.
 * 검색 입력 등 빈번한 업데이트로 부하 일으키는 API 호출 보호용.
 *
 * @template T
 * @param {T} value
 * @param {number} delay — ms
 * @returns {T}
 */
export const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
};
