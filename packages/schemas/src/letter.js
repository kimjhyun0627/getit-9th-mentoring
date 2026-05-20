/**
 * letter (익명 롤링페이퍼) 입력/응답 Zod 스키마.
 *
 * - MessageCreateInput: 메시지 작성 body
 * - MessageUpdateInput: 메시지 수정 body (content / color 부분 갱신)
 * - MessageIdParam: 경로 파라미터 :id
 * - MessageColor: 포스트잇 색상 enum (Prisma `MessageColor` 와 동일)
 *
 * BE/FE 공통 — `@getit/schemas/letter` 로 import.
 *
 * ⚠️ 익명성: 응답 직렬화에서 authorId 는 절대 노출 X. is_mine boolean 으로만
 * 본인 식별. 이 스키마는 입력/파라미터 검증만 담당하고, 응답 모양 강제는
 * BE 라우터의 serializer 책임 (#52). 보안 회귀 테스트는 #53 에서 별도.
 */
import { z } from 'zod';

/** 포스트잇 색상. Prisma enum `MessageColor` 와 동일. */
export const MessageColor = z.enum(['PINK', 'MINT', 'LEMON', 'LAVENDER']);

/**
 * 메시지 작성 입력.
 *
 * - content: 1~500자. trim. 빈 문자열 reject.
 * - color: 4색 enum (필수).
 */
export const MessageCreateInput = z.object({
  content: z
    .string({ required_error: '메시지 내용을 입력하세요' })
    .trim()
    .min(1, '메시지 내용을 입력하세요')
    .max(500, '메시지는 500자 이내'),
  color: MessageColor,
});

/**
 * 메시지 수정 입력 — content / color 부분 갱신. 둘 다 optional 이지만
 * 최소 한 필드는 와야 한다. 본인만 수정 가능 (라우터에서 authorId 검증).
 */
export const MessageUpdateInput = z
  .object({
    content: z.string().trim().min(1, '메시지 내용을 입력하세요').max(500).optional(),
    color: MessageColor.optional(),
  })
  .refine((d) => d.content !== undefined || d.color !== undefined, {
    message: 'content 또는 color 중 하나는 필요합니다',
  });

/** 경로 파라미터 :id (cuid 또는 임의 문자열 1~64자). */
export const MessageIdParam = z.object({
  id: z.string().min(1).max(64),
});

/**
 * @typedef {z.infer<typeof MessageColor>} MessageColorT
 * @typedef {z.infer<typeof MessageCreateInput>} MessageCreateInputT
 * @typedef {z.infer<typeof MessageUpdateInput>} MessageUpdateInputT
 */
