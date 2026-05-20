/**
 * letter — 메시지 정렬 헬퍼 (#307).
 *
 * 사용자가 선택하는 두 모드:
 *  - 'latest': 서버 응답 그대로 (BE 가 createdAt desc).
 *  - 'random': sessionSeed + id 해시 기반 deterministic shuffle.
 *     같은 세션 안에서 새로고침해도 순서 동일.
 *
 * localStorage key: 'letter:sort'.
 */

const STORAGE_KEY = 'letter:sort';
const SESSION_SEED_KEY = 'letter:sessionSeed';

/** @typedef {'latest' | 'random'} SortMode */

/**
 * 안전한 모드 파싱. invalid 면 'latest'.
 *
 * @param {unknown} v
 * @returns {SortMode}
 */
const normalize = (v) => (v === 'random' ? 'random' : 'latest');

/**
 * @returns {SortMode}
 */
export const readSortMode = () => {
  try {
    return normalize(window.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return 'latest';
  }
};

/**
 * @param {SortMode} mode
 */
export const writeSortMode = (mode) => {
  try {
    window.localStorage?.setItem(STORAGE_KEY, normalize(mode));
  } catch {
    // SSR / private mode — silent.
  }
};

/**
 * 세션 시드 — 새 탭마다 다름, 같은 탭 안에서는 동일. 정렬 흔들림 방지.
 *
 * @returns {number}
 */
const getSessionSeed = () => {
  try {
    const ss = window.sessionStorage;
    if (!ss) return 0;
    const cached = ss.getItem(SESSION_SEED_KEY);
    if (cached) {
      const n = Number.parseInt(cached, 10);
      if (Number.isFinite(n)) return n;
    }
    const fresh = Math.floor(Math.random() * 2 ** 31);
    ss.setItem(SESSION_SEED_KEY, String(fresh));
    return fresh;
  } catch {
    return 0;
  }
};

/**
 * deterministic hash (id, seed) → 정수.
 *
 * @param {string} id
 * @param {number} seed
 * @returns {number}
 */
const hash = (id, seed) => {
  let h = seed | 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return h;
};

/**
 * 메시지 배열을 모드대로 정렬한 새 배열 반환 (in-place X).
 *
 * @template {{ id: string }} T
 * @param {T[]} items
 * @param {SortMode} mode
 * @param {number} [seed] - 테스트용 주입.
 * @returns {T[]}
 */
export const sortMessages = (items, mode, seed) => {
  if (!Array.isArray(items)) return [];
  if (mode !== 'random') return items;
  const s = seed ?? getSessionSeed();
  return [...items].sort((a, b) => {
    const ha = hash(a.id, s);
    const hb = hash(b.id, s);
    if (ha !== hb) return ha - hb;
    // tiebreak — id 사전식.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
};
