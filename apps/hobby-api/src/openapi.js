/**
 * hobby-api OpenAPI 3.1 스펙 빌더.
 *
 * /api/docs 가 이걸 swagger-ui-express 로 렌더.
 */
import {
  ApplicationCreateInput,
  NotificationKind,
  NotificationListQuery,
  PostCreateInput,
  PostListQuery,
  PostStatus,
} from '@getit/schemas/hobby';
import { z } from 'zod';
import { createDocument, extendZodWithOpenApi } from 'zod-openapi';

extendZodWithOpenApi(z);

const TagResponse = z.object({ id: z.string(), name: z.string() }).openapi({ ref: 'Tag' });

const ApplicationResponse = z
  .object({
    id: z.string(),
    postId: z.string(),
    userId: z.string(),
    createdAt: z.string(),
  })
  .openapi({ ref: 'Application' });

const NotificationResponse = z
  .object({
    id: z.string(),
    userId: z.string(),
    postId: z.string().nullable(),
    kind: NotificationKind,
    message: z.string(),
    createdAt: z.string(),
    readAt: z.string().nullable(),
  })
  .openapi({ ref: 'Notification' });

const PostResponse = z
  .object({
    id: z.string(),
    ownerId: z.string(),
    title: z.string(),
    body: z.string(),
    meetAt: z.string(),
    capacity: z.number().int(),
    currentCapacity: z.number().int(),
    status: PostStatus,
    createdAt: z.string(),
    updatedAt: z.string(),
    tags: z.array(TagResponse),
    openChatUrl: z.string().optional(),
  })
  .openapi({ ref: 'Post' });

const ErrorResponse = z
  .object({
    error: z.string(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  })
  .openapi({ ref: 'Error' });

const ok = (schema) => ({ description: 'OK', content: { 'application/json': { schema } } });
const errResp = (description) => ({
  description,
  content: { 'application/json': { schema: ErrorResponse } },
});

export const buildOpenApiDoc = () =>
  createDocument({
    openapi: '3.1.0',
    info: {
      title: 'GETIT hobby-api',
      version: '0.1.0',
      description: '취미메이트 BE — 게시글 CRUD + 태그 + 페이지네이션',
    },
    paths: {
      '/api/health': {
        get: {
          summary: '헬스 체크',
          responses: { 200: ok(z.object({ ok: z.boolean(), service: z.string() })) },
        },
      },
      '/api/posts': {
        get: {
          summary: '게시글 리스트 (cursor 페이지네이션)',
          parameters: [
            { in: 'query', name: 'status', schema: PostStatus },
            { in: 'query', name: 'tag', schema: z.string() },
            { in: 'query', name: 'cursor', schema: z.string() },
            { in: 'query', name: 'limit', schema: z.number().int().min(1).max(50) },
          ],
          responses: {
            200: ok(z.object({ items: z.array(PostResponse), nextCursor: z.string().nullable() })),
            400: errResp('ValidationError'),
          },
        },
        post: {
          summary: '게시글 작성 (JWT 필요)',
          security: [{ bearerAuth: [] }],
          requestBody: { content: { 'application/json': { schema: PostCreateInput } } },
          responses: {
            201: ok(z.object({ post: PostResponse })),
            400: errResp('ValidationError'),
            401: errResp('Unauthorized'),
          },
        },
      },
      '/api/applications': {
        post: {
          summary: '매칭 신청 (JWT 필요, race-safe)',
          security: [{ bearerAuth: [] }],
          requestBody: { content: { 'application/json': { schema: ApplicationCreateInput } } },
          responses: {
            201: ok(z.object({ application: ApplicationResponse })),
            400: errResp('ValidationError'),
            401: errResp('Unauthorized'),
            404: errResp('PostNotFound'),
            409: errResp('AlreadyApplied / OwnerCannotApply'),
            422: errResp('PostFull / PostNotOpen'),
          },
        },
      },
      '/api/applications/{id}': {
        delete: {
          summary: '매칭 신청 취소 (JWT 필요, 본인만)',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: z.string() }],
          responses: {
            204: { description: 'No Content' },
            401: errResp('Unauthorized'),
            403: errResp('Forbidden'),
            404: errResp('ApplicationNotFound'),
          },
        },
      },
      '/api/notifications': {
        get: {
          summary: '본인 알림 리스트 (JWT 필요, cursor 페이지네이션)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'cursor', schema: z.string() },
            { in: 'query', name: 'limit', schema: z.number().int().min(1).max(50) },
            { in: 'query', name: 'unreadOnly', schema: z.boolean() },
          ],
          responses: {
            200: ok(
              z.object({
                items: z.array(NotificationResponse),
                nextCursor: z.string().nullable(),
              }),
            ),
            400: errResp('ValidationError'),
            401: errResp('Unauthorized'),
          },
        },
      },
      '/api/posts/{id}': {
        get: {
          summary: '게시글 상세 (인증 선택 — owner 면 openChatUrl 노출)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: z.string() }],
          responses: {
            200: ok(z.object({ post: PostResponse })),
            404: errResp('PostNotFound'),
          },
        },
        delete: {
          summary: '게시글 삭제 (본인만)',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: z.string() }],
          responses: {
            204: { description: 'No Content' },
            401: errResp('Unauthorized'),
            403: errResp('Forbidden'),
            404: errResp('PostNotFound'),
          },
        },
      },
    },
    components: {
      // PostListQuery 직접 export 도 같이 reference 로 노출.
      schemas: {
        PostListQuery: PostListQuery.openapi({ ref: 'PostListQuery' }),
        NotificationListQuery: NotificationListQuery.openapi({ ref: 'NotificationListQuery' }),
      },
      // JWT Bearer — POST/DELETE /api/posts 의 auth 미들웨어와 매핑.
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  });
