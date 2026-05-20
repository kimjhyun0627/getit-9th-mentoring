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
export const ShelfAddInput = z
  .object({
    isbn: z
      .string()
      .regex(/^(?:\d{10}|\d{9}[Xx]|\d{13})$/, 'invalid isbn')
      .optional(),
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
 * @typedef {z.infer<typeof ShelfAddInput>} ShelfAddInputT
 * @typedef {z.infer<typeof ShelfUpdateInput>} ShelfUpdateInputT
 */
