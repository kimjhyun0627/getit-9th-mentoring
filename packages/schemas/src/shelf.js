/**
 * shelf 도메인 Zod 스키마 — FE/BE 공유.
 *
 * - 서재 추가 / 수정 입력
 * - status: WANT | READING | READ
 * - rating: 0-5 정수 (0은 별점 없음 의미로 허용. spec "0-5 범위 검증")
 * - review: 최대 5000자
 *
 * shelf-api 라우터 (`apps/shelf-api/src/routes/shelves.js`) 에서 입력 검증에 사용.
 */
import { z } from 'zod';

/** 가능한 책 상태 — 스키마와 동기. */
export const ShelfStatus = z.enum(['WANT', 'READING', 'READ']);

/** 별점 — 0~5 정수. 0은 '별점 없음' 의미로 허용. */
const ratingSchema = z
  .number({ invalid_type_error: '별점은 숫자여야 합니다' })
  .int('별점은 정수여야 합니다')
  .min(0, '별점은 0 이상이어야 합니다')
  .max(5, '별점은 5 이하여야 합니다');

/** 감상평 — 최대 5000자. */
const reviewSchema = z.string().max(5000, '감상평은 5000자 이내').nullable();

/**
 * 서재 추가 입력.
 *
 * 책 식별: isbn 또는 bookId 중 하나 필수.
 * - isbn: 캐시 미스면 라우터에서 외부 API 호출 후 Book upsert
 * - bookId: 이미 캐시된 Book.id 직접 지정
 */
/**
 * ISBN 정규화 — 하이픈/공백 제거 + ISBN-10 끝자리 X 대문자 통일 (#224).
 *
 * 같은 ISBN-10 이 `123456789x` / `123456789X` 두 형태로 들어오면 캐시 키 불일치로
 * 같은 책에 row 2개 생성. 항상 대문자로 통일해 캐시 hit률 유지.
 *
 * @param {unknown} v
 * @returns {unknown}
 */
export const normalizeIsbn = (v) => {
  if (typeof v !== 'string') return v;
  return v.replace(/[\s-]/g, '').toUpperCase();
};

/**
 * ISBN 입력 — 하이픈/공백 정규화 후 ISBN-10 / ISBN-13 검증.
 *
 * 실제 입력은 `978-89-329-1724-5`, `9788932917245`, `123456789x` 모두 흔함 →
 * 입력 시 strip + X 대문자화 한 뒤 검증. 정규화된 값은 캐시 키로 안전하다.
 */
const isbnSchema = z.preprocess(
  normalizeIsbn,
  z.string().regex(/^(?:\d{10}|\d{9}X|\d{13})$/, 'invalid isbn'),
);

export const ShelfAddInput = z
  .object({
    isbn: isbnSchema.optional(),
    bookId: z.string().trim().min(1).optional(),
    status: ShelfStatus.default('WANT'),
    rating: ratingSchema.optional(),
    review: reviewSchema.optional(),
  })
  .refine((d) => d.isbn !== undefined || d.bookId !== undefined, {
    message: 'isbn 또는 bookId 중 하나는 필요합니다',
  });

/**
 * 서재 수정 입력 — 최소 1개 필드 필요.
 */
export const ShelfUpdateInput = z
  .object({
    status: ShelfStatus.optional(),
    rating: ratingSchema.nullable().optional(),
    review: reviewSchema.optional(),
  })
  .refine((d) => d.status !== undefined || d.rating !== undefined || d.review !== undefined, {
    message: 'status, rating, review 중 하나는 필요합니다',
  });

/**
 * 서재 목록 정렬 옵션 — GET /shelves/me?sort=<key>.
 *
 * - addedAt-desc: 최근 추가 순 (기본값)
 * - addedAt-asc: 오래된 추가 순
 * - completedAt-desc: 최근 완독 순 (READ 상태만 의미 있음, null 은 뒤로)
 * - rating-desc: 별점 높은 순 (null/0 은 뒤로)
 * - title-asc: 제목 가나다 (book.title 기준)
 */
export const ShelfSortKey = z.enum([
  'addedAt-desc',
  'addedAt-asc',
  'completedAt-desc',
  'rating-desc',
  'title-asc',
]);

/** ShelfSortKey 의 기본값 — 라우터/FE 양쪽에서 공유. */
export const SHELF_SORT_DEFAULT = 'addedAt-desc';

/**
 * @typedef {z.infer<typeof ShelfAddInput>} ShelfAddInputT
 * @typedef {z.infer<typeof ShelfUpdateInput>} ShelfUpdateInputT
 * @typedef {z.infer<typeof ShelfSortKey>} ShelfSortKeyT
 */
