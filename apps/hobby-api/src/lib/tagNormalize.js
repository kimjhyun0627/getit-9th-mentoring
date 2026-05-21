/**
 * 태그 이름 정규화 — trim + 소문자. 같은 이름의 중복 entry 도 제거.
 *
 * posts.js (create) 와 posts.mutations.js (update) 가 동일 로직을 중복 정의했었음.
 * 한 곳으로 통합. 양쪽 호출 형태를 모두 흡수하기 위해 String 래핑.
 *
 * @param {Array<string|unknown>} raw
 * @returns {string[]}
 */
export const normalizeTagNames = (raw) => {
  const seen = new Set();
  for (const t of raw) {
    const k = String(t).trim().toLowerCase();
    if (k) seen.add(k);
  }
  return [...seen];
};
