/**
 * 카드 mutation 공용 헬퍼.
 *
 *  - newTempId: optimistic create 용 임시 id 생성. crypto.randomUUID 우선, fallback 은
 *    timestamp + 강한 랜덤. (#242)
 *  - dedupById: 같은 id 가 두 번 들어오면 마지막 entry 만 남긴다. move/optimistic 합성 시
 *    중복 entry 방지 (#291).
 *  - makeInvalidateBatch: 자기 mutation settled 후 ['cards-batch', projectId] 를
 *    한 번 invalidate 해 다른 사용자의 변경을 반영한다 (#314).
 */

/**
 * Optimistic temp id 생성기.
 *
 * @returns {string}
 */
export const newTempId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `temp-${crypto.randomUUID()}`;
    }
  } catch {
    // fallthrough
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * 중복 id 제거 — 마지막 entry 만 유지.
 *
 * @template {{ id: string }} T
 * @param {T[]} list
 * @returns {T[]}
 */
export const dedupById = (list) => {
  const seen = new Set();
  const out = [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  out.reverse();
  return out;
};

/**
 * cards-batch 캐시를 한 번 invalidate 하는 함수 팩토리.
 *
 * settled 시점엔 optimistic 이 이미 real data 로 교체된 상태라 덮어쓰기 안전.
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string | undefined} projectId
 * @returns {() => void}
 */
export const makeInvalidateBatch = (queryClient, projectId) => () => {
  if (!projectId) return;
  queryClient.invalidateQueries({ queryKey: ['cards-batch', projectId] });
};
