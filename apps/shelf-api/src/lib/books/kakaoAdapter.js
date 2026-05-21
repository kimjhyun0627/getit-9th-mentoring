/**
 * 카카오 도서 API ↔ Book DB row 어댑터.
 *
 * 책임:
 *  - `lib/external/kakao.js` 의 raw fetch 결과를 `Book` upsert 입력으로 변환
 *  - Prisma `book.upsert` 호출 wrapping (라우터가 같은 로직 두 번 안 쓰게)
 *  - graceful degrade helper (`isKakaoError`) 로 503 vs throw 분기를 라우터에서 단순화
 *
 * 외부 API 호출은 여전히 `lib/external/kakao.js` 가 담당. 본 모듈은 그 위에 얇은
 * application 레이어를 둬서 라우터가 prisma + 변환 디테일을 안 보게 한다.
 */
import {
  KakaoApiError,
  KakaoConfigError,
  searchKakaoBooks,
  toBookRecord,
} from '../external/kakao.js';
import { prisma } from '../prisma.js';

/**
 * 카카오 호출 실패가 "외부 의존" 에러인지 (graceful degrade 대상).
 *
 * - KakaoConfigError: API 키 미설정 — 운영 사고
 * - KakaoApiError: 4xx/5xx/네트워크 — 일시 장애
 *
 * 둘 다 stale 캐시가 있으면 stale 반환, 없으면 503 으로 매핑.
 * 그 외 에러는 진짜 버그라 throw 유지.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export const isKakaoError = (err) =>
  err instanceof KakaoConfigError || err instanceof KakaoApiError;

/**
 * Book 도메인 객체를 Prisma upsert. cachedAt 은 prisma `@updatedAt` 으로 자동 갱신.
 *
 * 호출자는 `record !== null` 보장 후 진입해야 함 (kakaoAdapter는 null drop 책임을
 * `searchBooks` 에서 처리). 타입에 `Exclude<..., null>` 박아서 null 가드 누락을 컴파일/IDE
 * 단계에서 잡는다.
 *
 * @param {Exclude<ReturnType<typeof toBookRecord>, null>} record
 */
export const upsertBook = (record) =>
  prisma.book.upsert({
    where: { isbn: record.isbn },
    create: record,
    update: {
      title: record.title,
      author: record.author,
      publisher: record.publisher,
      publishedAt: record.publishedAt,
      coverUrl: record.coverUrl,
      description: record.description,
      source: record.source,
    },
  });

/**
 * 카카오 검색 호출 + Book record 변환을 한 번에.
 * 외부 호출 결과 `documents` 를 `toBookRecord` 매핑 + null drop 까지 처리.
 *
 * 라우터는 try/catch 로 `isKakaoError` 만 검사하면 됨.
 *
 * #527: meta 도 같이 노출 — 라우터가 `is_end` / `total_count` 를 무한 스크롤 응답에
 * 그대로 흘려보낼 수 있어야 함. null drop 으로 records 수가 documents 수보다 적어질 수
 * 있지만 meta 는 카카오 기준 그대로 유지 (페이지 종료 판정은 외부 source of truth).
 *
 * @param {{ query: string, apiKey: string, target?: string, page?: number, size?: number }} params
 * @returns {Promise<{
 *   records: Array<Exclude<ReturnType<typeof toBookRecord>, null>>,
 *   meta: { is_end: boolean, pageable_count: number, total_count: number },
 * }>}
 */
export const searchBooks = async (params) => {
  const { documents, meta } = await searchKakaoBooks(params);
  /** @type {Array<Exclude<ReturnType<typeof toBookRecord>, null>>} */
  const records = [];
  for (const doc of documents) {
    const record = toBookRecord(doc);
    if (record !== null) records.push(record);
  }
  return { records, meta };
};
