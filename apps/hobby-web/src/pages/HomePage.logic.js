/**
 * HomePage 클라이언트 필터 로직 — 검색 + 시간 chip.
 * 서버 GET /api/posts 는 status/tag/cursor 만 지원하므로,
 * 자유 텍스트 검색과 "오늘/이번주" 시간 윈도우는 여기서 한다.
 *
 * 분리 이유:
 *  - HomePage 가 300줄 가까이 가는 걸 막고
 *  - 순수 함수라 단위 테스트하기 쉽게.
 */

/**
 * 같은 자정 기준 day diff 계산.
 *
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */
const dayDiff = (a, b) => {
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOf(a) - startOf(b)) / 86400000);
};

/**
 * 검색어 매칭 — 제목/장소/태그 부분 일치 (case-insensitive).
 *
 * @param {{ title: string; location?: string; tags?: { name: string }[] }} post
 * @param {string} q
 * @returns {boolean}
 */
const matchesSearch = (post, q) => {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [post.title, post.location ?? '', ...(post.tags?.map((t) => t.name) ?? [])]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
};

/**
 * 시간 chip 매칭 — 'today' / 'week' / 'all'.
 *
 * @param {{ meetAt: string }} post
 * @param {'today' | 'week' | 'all'} timeKey
 * @param {Date} now
 * @returns {boolean}
 */
const matchesTime = (post, timeKey, now) => {
  if (timeKey === 'all') return true;
  const meet = new Date(post.meetAt);
  if (Number.isNaN(meet.getTime())) return false;
  const diff = dayDiff(meet, now);
  if (timeKey === 'today') return diff === 0;
  if (timeKey === 'week') return diff >= 0 && diff <= 6;
  return true;
};

/**
 * 게시글 리스트에 검색/시간 필터 적용.
 *
 * @template {{ title: string; meetAt: string; location?: string; tags?: { name: string }[] }} T
 * @param {T[]} posts
 * @param {{ search: string; timeKey: 'all' | 'today' | 'week'; now?: Date }} opts
 * @returns {T[]}
 */
export const filterPosts = (posts, { search, timeKey, now = new Date() }) => {
  return posts.filter((p) => matchesSearch(p, search) && matchesTime(p, timeKey, now));
};
