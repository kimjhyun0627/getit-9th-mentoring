/**
 * hobby (취미메이트) 입력/응답 Zod 스키마.
 *
 * - PostCreateInput: 게시글 작성 body
 * - PostListQuery: 리스트 조회 query string
 * - PostIdParam: 경로 파라미터 :id
 *
 * BE/FE 공통 — `@getit/schemas/hobby` 로 import.
 */
import { z } from 'zod';

/** 게시글 상태. Prisma enum `PostStatus` 와 동일. */
export const PostStatus = z.enum(['RECRUITING', 'FULL', 'CLOSED']);

/**
 * 태그 이름.
 * - 1~24자, 한/영/숫자만. trim. 소문자화는 BE 책임 (대소문자 구분 없이 unique).
 */
const TagName = z
  .string()
  .trim()
  .min(1, '태그는 1자 이상')
  .max(24, '태그는 24자 이내')
  .regex(/^[\p{L}\p{N}_-]+$/u, '태그는 글자/숫자/-_만 사용 가능');

/**
 * 게시글 작성 입력.
 *
 * - meetAt: ISO 8601 문자열 → Date 로 coerce. 과거 시각이면 reject.
 * - capacity: 2~20 (방장 포함 가정).
 * - openChatUrl: 카카오 오픈채팅 https URL (host=open.kakao.com, path=/o/...).
 * - tags: 최대 5개.
 */
export const PostCreateInput = z.object({
  title: z.string().trim().min(2, '제목은 2자 이상').max(80, '제목은 80자 이내'),
  body: z.string().trim().min(1, '본문을 입력하세요').max(2000, '본문은 2000자 이내'),
  meetAt: z
    .string({ invalid_type_error: '유효한 일시가 아닙니다' })
    .datetime({ offset: true, message: '유효한 ISO 8601 일시 문자열이 아닙니다' })
    .transform((s) => new Date(s))
    .refine((d) => d.getTime() > Date.now(), { message: '과거 시각은 입력할 수 없습니다' }),
  capacity: z
    .number({ invalid_type_error: '정원은 숫자여야 합니다' })
    .int('정원은 정수여야 합니다')
    .min(2, '정원은 2명 이상')
    .max(20, '정원은 20명 이하'),
  openChatUrl: z
    .string()
    .url('유효한 URL이 아닙니다')
    .max(512)
    .refine(
      (v) => {
        // 카카오 오픈채팅 URL 만 허용 — 도메인/path 까지 고정해서 임의 https 링크 차단.
        try {
          const u = new URL(v);
          return (
            u.protocol === 'https:' &&
            u.hostname === 'open.kakao.com' &&
            u.pathname.startsWith('/o/')
          );
        } catch {
          return false;
        }
      },
      { message: '카카오 오픈채팅 URL (https://open.kakao.com/o/...) 만 허용됩니다' },
    ),
  tags: z.array(TagName).max(5, '태그는 최대 5개').default([]),
});

/**
 * 리스트 조회 query.
 *
 * - status: 단일 PostStatus (생략 시 RECRUITING + FULL).
 * - tag: 태그 이름 (단일). 매칭 게시글만 필터.
 * - cursor: 이전 page 의 마지막 id (생략 시 첫 페이지).
 * - limit: 1~50, 기본 20.
 */
export const PostListQuery = z.object({
  status: PostStatus.optional(),
  tag: TagName.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** 경로 파라미터 :id (cuid 또는 임의 문자열 1~64자). */
export const PostIdParam = z.object({
  id: z.string().min(1).max(64),
});

/**
 * @typedef {z.infer<typeof PostCreateInput>} PostCreateInputT
 * @typedef {z.infer<typeof PostListQuery>} PostListQueryT
 * @typedef {z.infer<typeof PostStatus>} PostStatusT
 */
