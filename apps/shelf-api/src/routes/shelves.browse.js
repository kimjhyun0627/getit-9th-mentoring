/**
 * GET /api/shelves/browse — 부원 서재 디렉토리 (#561).
 *
 * 다른 사용자 서재 발견 경로. UserShelfPage (`/u/:userId`, #292) 가 존재하지만
 * UI 진입점 없어 사용자가 직접 URL 쳐야 했음. 이 엔드포인트가 BrowsePage 의 데이터 소스.
 *
 * 정책:
 *  - 공개 디렉토리 (UserShelfPage 와 동일 트러스트). requireAuth 전 등록.
 *  - userNickname 스냅샷이 있는 (trim 후 비어있지 않은) 사용자만 노출.
 *    학교 인증 onboarding 완료자 + privacy + UX (cuid 만 보여주면 무의미).
 *  - 책 1권 이상 보유 자동 (group-by 가 0 권 user 자동 제외).
 *  - 책 권 수만 노출. 책 목록은 `/u/:userId` 페이지 가야 보임.
 *  - sort: bookCount desc (default) / recent (latest addedAt) desc.
 *  - 페이지네이션: page/pageSize (max 100) + total/page/pageSize 메타.
 */

/**
 * BookShelf row 들에서 noisy 한 userNickname 을 정규화.
 *
 * @param {string | null | undefined} v
 * @returns {string | null} trim 후 비어있지 않으면 trim 결과, 아니면 null.
 */
const normalizeNickname = (v) => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * BookShelf row 들을 userId 별로 집계.
 *
 * userNickname 이 비어있는 user 는 제외.
 * nickname 은 가장 최근 row 의 정규화된 값 (사용자가 닉 바꿔도 최신 표시).
 *
 * @param {Array<{ userId: string, userNickname: string | null, addedAt: Date | string }>} rows
 * @returns {Array<{
 *   userId: string,
 *   nickname: string,
 *   bookCount: number,
 *   latestAddedAt: Date,
 * }>}
 */
export const aggregateByUser = (rows) => {
  /**
   * @type {Map<string, {
   *   userId: string,
   *   nickname: string | null,
   *   bookCount: number,
   *   latestAddedAt: Date,
   *   latestNicknameAt: Date,
   * }>}
   */
  const byUser = new Map();

  for (const r of rows) {
    const addedAt = r.addedAt instanceof Date ? r.addedAt : new Date(r.addedAt);
    const nickname = normalizeNickname(r.userNickname);
    const existing = byUser.get(r.userId);
    if (!existing) {
      byUser.set(r.userId, {
        userId: r.userId,
        nickname,
        bookCount: 1,
        latestAddedAt: addedAt,
        // nickname 이 null 이면 latestNicknameAt 도 epoch 로 — 나중 갱신 우선권 명확
        latestNicknameAt: nickname ? addedAt : new Date(0),
      });
      continue;
    }
    existing.bookCount += 1;
    if (addedAt > existing.latestAddedAt) existing.latestAddedAt = addedAt;
    // 가장 최신 nickname row 가 표시 (사용자가 닉 바꿔도 직전 추가 책 기준 최신).
    if (nickname && addedAt >= existing.latestNicknameAt) {
      existing.nickname = nickname;
      existing.latestNicknameAt = addedAt;
    }
  }

  // nickname 없는 user 자동 제외 (privacy + UX).
  const filtered = [];
  for (const u of byUser.values()) {
    if (u.nickname) filtered.push(u);
  }
  return filtered;
};

/**
 * sort key 로 사용자 배열 정렬 (in-place).
 *
 * - bookCount (default): 책 권 수 desc, tie 시 latestAddedAt desc, tie 시 userId asc
 *   (deterministic 정렬 — 페이지네이션 안정성).
 * - recent: latestAddedAt desc, tie 시 bookCount desc, tie 시 userId asc.
 *
 * @param {ReturnType<typeof aggregateByUser>} users
 * @param {'bookCount' | 'recent'} sort
 * @returns {ReturnType<typeof aggregateByUser>}
 */
export const sortUsers = (users, sort) => {
  const cmpRecent = (a, b) =>
    b.latestAddedAt - a.latestAddedAt ||
    b.bookCount - a.bookCount ||
    a.userId.localeCompare(b.userId);
  const cmpCount = (a, b) =>
    b.bookCount - a.bookCount ||
    b.latestAddedAt - a.latestAddedAt ||
    a.userId.localeCompare(b.userId);
  return [...users].sort(sort === 'recent' ? cmpRecent : cmpCount);
};

/**
 * @typedef {{
 *   ok: true,
 *   page: number,
 *   pageSize: number,
 *   skip: number,
 *   sort: 'bookCount' | 'recent',
 * } | {
 *   ok: false,
 *   body: any,
 * }} BrowseQueryParseResult
 */

/**
 * 페이지/페이지사이즈/sort 파싱. /me 와 다른 sort key 라 별도 파서.
 *
 * @param {Record<string, any>} query
 * @returns {BrowseQueryParseResult}
 */
export const parseBrowseQuery = (query) => {
  const pageRaw = Number.parseInt(query.page, 10);
  const pageSizeRaw = Number.parseInt(query.pageSize, 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1 ? Math.min(pageSizeRaw, 100) : 20;
  const skip = (page - 1) * pageSize;

  const sortParam = query.sort;
  /** @type {'bookCount' | 'recent'} */
  let sort = 'bookCount';
  if (sortParam !== undefined) {
    if (sortParam === 'bookCount' || sortParam === 'recent') {
      sort = sortParam;
    } else {
      return {
        ok: false,
        body: {
          error: 'ValidationError',
          issues: [{ path: 'sort', message: 'sort must be bookCount or recent' }],
        },
      };
    }
  }
  return { ok: true, page, pageSize, skip, sort };
};

/**
 * 공개 응답 직렬화 — userId / nickname / bookCount 만. 책 목록 미노출.
 *
 * @param {{ userId: string, nickname: string, bookCount: number }} u
 */
export const publicBrowseUser = (u) => ({
  userId: u.userId,
  nickname: u.nickname,
  bookCount: u.bookCount,
});
