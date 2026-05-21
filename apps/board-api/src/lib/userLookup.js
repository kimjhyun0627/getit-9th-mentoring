/**
 * Cross-DB User lookup (#398).
 *
 * board-api 는 자체 schema (`board`) 만 알지만, auth-api 와 같은 MySQL 인스턴스를
 * 공유하고 동일 app user 가 `auth` schema 에도 권한이 있다. 멤버 목록에 이름을
 * 노출하기 위해 `auth.User` 를 raw SQL 로 조회한다.
 *
 * - 실패는 swallow → name 없는 응답으로 graceful degrade.
 * - 빈 입력 / fake-prisma 테스트 환경에서도 안전하게 빈 Map 반환.
 * - SQL injection 회피: Prisma.sql + ANY 비교가 아니라 `IN (?)` placeholder 풀어쓰기.
 */
import { prisma } from './prisma.js';

/**
 * userId 배열을 받아 `{ userId: name }` Map 으로 돌려준다.
 * 조회 실패 / 환경 미지원 시 빈 Map.
 *
 * @param {string[]} userIds
 * @returns {Promise<Map<string, string>>}
 */
export const lookupUserNames = async (userIds) => {
  /** @type {Map<string, string>} */
  const out = new Map();
  if (!Array.isArray(userIds) || userIds.length === 0) return out;
  const unique = [...new Set(userIds.filter((id) => typeof id === 'string' && id.length > 0))];
  if (unique.length === 0) return out;

  // fake-prisma 는 $queryRawUnsafe 미지원 → typeof check 로 분기.
  if (typeof prisma.$queryRawUnsafe !== 'function') return out;

  try {
    const placeholders = unique.map(() => '?').join(', ');
    const sql = `SELECT id, name FROM auth.User WHERE id IN (${placeholders})`;
    const rows = await prisma.$queryRawUnsafe(sql, ...unique);
    if (Array.isArray(rows)) {
      for (const r of rows) {
        if (r && typeof r.id === 'string' && typeof r.name === 'string') {
          out.set(r.id, r.name);
        }
      }
    }
  } catch (err) {
    // 권한 / schema 미존재 / 네트워크 — graceful degrade 하되 운영 추적 가능하도록
    // 최소 한 줄 warn 로그는 남긴다 (PII 회피 위해 userId 는 count 만).
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[board-api] lookupUserNames failed', {
      count: unique.length,
      error: msg,
    });
  }
  return out;
};
