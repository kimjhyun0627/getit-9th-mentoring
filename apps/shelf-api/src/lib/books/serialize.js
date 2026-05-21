/**
 * Book DB row → API 응답 직렬화.
 *
 * cached/stale flag 부착. 라우터 별 cache hit 여부에 따라 호출 측에서 결정.
 */

/**
 * Book row → 응답 JSON.
 *
 * @param {Record<string, any>} row — Prisma Book row
 * @param {{ cached: boolean, stale?: boolean }} flags
 * @returns {Record<string, any>}
 */
export const serializeBook = (row, flags) => ({
  isbn: row.isbn,
  title: row.title,
  author: row.author,
  publisher: row.publisher,
  publishedAt: row.publishedAt,
  coverUrl: row.coverUrl,
  description: row.description,
  source: row.source,
  cachedAt: row.cachedAt,
  cached: flags.cached,
  stale: flags.stale ?? false,
});
