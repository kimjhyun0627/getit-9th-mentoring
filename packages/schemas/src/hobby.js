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

/** 신청 정책 (#500). Prisma enum `ApplicationPolicy` 와 동일. */
export const ApplicationPolicy = z.enum(['FIRST_COME', 'APPROVAL']);

/** 신청 상태 (#500). Prisma enum `ApplicationStatus` 와 동일. */
export const ApplicationStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

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
  // #500: 정책. 미지정 시 기본 FIRST_COME (backward-compat).
  applicationPolicy: ApplicationPolicy.default('FIRST_COME'),
});

/**
 * 시간 윈도우 필터 — 'today' / 'week' / 'all'.
 *
 * BE 에서 `meetAt` 범위로 환산해 필터링. 생략(또는 'all') 시 미적용.
 */
export const TimeWindow = z.enum(['all', 'today', 'week']);

/**
 * 리스트 조회 query.
 *
 * - status: 단일 PostStatus (생략 시 RECRUITING + FULL).
 * - tag: 태그 이름 (단일). 매칭 게시글만 필터.
 * - q: 자유 텍스트 검색 (title/body 부분 일치, case-insensitive, 1~80자).
 * - timeWindow: 'today'|'week'|'all' (#229 — 클라이언트 필터를 서버로 이전).
 * - cursor: 이전 page 의 마지막 id (생략 시 첫 페이지).
 * - limit: 1~50, 기본 20.
 *
 * `q` 와 `timeWindow` 는 서버에서 처리해야 cursor 페이지네이션 결과가 정확하다.
 * 클라이언트 후처리 + cursor 조합은 페이지 경계마다 결과 누락이 발생함 (#229).
 */
export const PostListQuery = z.object({
  status: PostStatus.optional(),
  tag: TagName.optional(),
  q: z.string().trim().min(1).max(80).optional(),
  timeWindow: TimeWindow.optional().default('all'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** 경로 파라미터 :id (cuid 또는 임의 문자열 1~64자). */
export const PostIdParam = z.object({
  id: z.string().min(1).max(64),
});

/**
 * 게시글 수정 입력 — partial update (PATCH).
 *
 * 정책 (#333):
 *  - 방장만 수정 가능 (BE 권한 검증).
 *  - meetAt: 변경하려면 ISO 8601 + 미래 시각.
 *  - capacity: 신청자 수보다 작게 낮추면 422 (BE 검증).
 *  - status: 직접 변경 불가 — 별도 close 엔드포인트 사용.
 *  - openChatUrl: 동일 카카오 도메인 규칙.
 *  - tags: 전체 교체 (현재 connect 패턴과 동일하게 BE 재구성).
 */
export const PostUpdateInput = z
  .object({
    title: z.string().trim().min(2, '제목은 2자 이상').max(80, '제목은 80자 이내').optional(),
    body: z.string().trim().min(1, '본문을 입력하세요').max(2000, '본문은 2000자 이내').optional(),
    meetAt: z
      .string({ invalid_type_error: '유효한 일시가 아닙니다' })
      .datetime({ offset: true, message: '유효한 ISO 8601 일시 문자열이 아닙니다' })
      .transform((s) => new Date(s))
      .refine((d) => d.getTime() > Date.now(), { message: '과거 시각은 입력할 수 없습니다' })
      .optional(),
    capacity: z
      .number({ invalid_type_error: '정원은 숫자여야 합니다' })
      .int('정원은 정수여야 합니다')
      .min(2, '정원은 2명 이상')
      .max(20, '정원은 20명 이하')
      .optional(),
    openChatUrl: z
      .string()
      .url('유효한 URL이 아닙니다')
      .max(512)
      .refine(
        (v) => {
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
      )
      .optional(),
    tags: z.array(TagName).max(5, '태그는 최대 5개').optional(),
    // #500: 정책 변경. 미지정이면 유지. 정책 변경은 BE 가 신청자 존재 시 422 거부.
    applicationPolicy: ApplicationPolicy.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: '수정할 필드를 1개 이상 보내야 합니다',
  });

/**
 * 매칭 신청 입력.
 * - postId: 신청할 게시글 id.
 * userId 는 JWT 의 sub 를 사용 (body 로 받지 않음 — spoof 방지).
 */
export const ApplicationCreateInput = z.object({
  postId: z.string().min(1).max(64),
});

/**
 * 노쇼 신고 입력 (#247).
 * - applicantIds: 노쇼로 신고할 신청자 userId 배열 (방장이 호출).
 *   1개 이상 20개 이하. cuid/userId 문자열 1~64자.
 *
 * 정책:
 *  - 방장만 호출. 해당 post 의 application 에 속한 userId 만 허용 (BE 검증).
 *  - meetAt 이 지난 모임만 허용 (모임 끝나기 전 신고 금지).
 *  - 멱등: 이미 NO_SHOW 마크된 application 은 무시 (재신고 시 count 안 올라감).
 */
export const NoShowReportInput = z.object({
  applicantIds: z
    .array(z.string().min(1).max(64))
    .min(1, '신고할 신청자를 1명 이상 선택하세요')
    .max(20, '한 번에 20명까지'),
});

/** 경로 파라미터 :id (Application.id). */
export const ApplicationIdParam = z.object({
  id: z.string().min(1).max(64),
});

/**
 * 알림 종류. enum 미강제 (BE schema.prisma 의 String kind 와 일치) — 향후 확장 자유.
 * 알려진 값만 클라이언트가 표시 분기에 쓰면 됨.
 */
export const NotificationKind = z.enum([
  'MATCH_FULL',
  'APPLICATION_CANCELED',
  'NO_SHOW_REPORTED',
  'POST_CLOSED',
  // #500: 신청 정책 알림.
  'APPLICATION_PENDING', // 방장 수신 — 새 PENDING 신청 도착.
  'APPLICATION_APPROVED', // 신청자 수신 — 방장 승인.
  'APPLICATION_REJECTED', // 신청자 수신 — 방장 거절.
]);

/**
 * 알림 리스트 조회 query.
 * - limit: 1~50, 기본 20.
 * - cursor: 이전 page 의 마지막 id.
 * - unreadOnly: 'true' 면 readAt is null 만 (query string 은 항상 string).
 */
export const NotificationListQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.enum(['true', 'false', '1', '0']).optional().default('false'),
});

/**
 * 마이페이지 내 게시글 조회 query.
 * - status 미지정 시 전체 (RECRUITING/FULL/CLOSED 포함). `/api/me/posts` 는
 *   본인 게시글이므로 closed 도 노출이 정상.
 */
export const MyPostListQuery = z.object({
  status: PostStatus.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * 마이페이지 내 신청 조회 query.
 */
export const MyApplicationListQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * @typedef {z.infer<typeof PostCreateInput>} PostCreateInputT
 * @typedef {z.infer<typeof PostUpdateInput>} PostUpdateInputT
 * @typedef {z.infer<typeof PostListQuery>} PostListQueryT
 * @typedef {z.infer<typeof PostStatus>} PostStatusT
 * @typedef {z.infer<typeof TimeWindow>} TimeWindowT
 * @typedef {z.infer<typeof ApplicationCreateInput>} ApplicationCreateInputT
 * @typedef {z.infer<typeof NoShowReportInput>} NoShowReportInputT
 * @typedef {z.infer<typeof NotificationListQuery>} NotificationListQueryT
 * @typedef {z.infer<typeof NotificationKind>} NotificationKindT
 * @typedef {z.infer<typeof MyPostListQuery>} MyPostListQueryT
 * @typedef {z.infer<typeof MyApplicationListQuery>} MyApplicationListQueryT
 */
