/**
 * OpenAPI 3.1 스펙 빌더 — `zod-openapi`로 5개 엔드포인트 스키마 등록.
 *
 * /api/docs 가 이걸 swagger-ui-express로 렌더.
 */
import {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from '@getit/schemas/auth';
import { z } from 'zod';
import { createDocument, extendZodWithOpenApi } from 'zod-openapi';

extendZodWithOpenApi(z);

const UserResponse = z
  .object({
    sub: z.string(),
    email: z.string().email(),
    name: z.string(),
  })
  .openapi({ ref: 'User' });

const ErrorResponse = z
  .object({
    error: z.string(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  })
  .openapi({ ref: 'Error' });

const ok = (schema) => ({
  description: 'OK',
  content: { 'application/json': { schema } },
});

const errResp = (description) => ({
  description,
  content: { 'application/json': { schema: ErrorResponse } },
});

/**
 * OpenAPI 도큐먼트 빌드.
 *
 * @returns {object}
 */
export const buildOpenApiDoc = () =>
  createDocument({
    openapi: '3.1.0',
    info: {
      title: 'GETIT auth-api',
      version: '0.1.0',
      description: '통합 SSO BE — signup / login / logout / refresh / me',
    },
    paths: {
      '/api/health': {
        get: {
          summary: '헬스 체크',
          responses: { 200: ok(z.object({ ok: z.boolean(), service: z.string() })) },
        },
      },
      '/api/signup': {
        post: {
          summary: '회원가입',
          requestBody: { content: { 'application/json': { schema: SignupInput } } },
          responses: {
            201: ok(z.object({ user: UserResponse })),
            400: errResp('ValidationError'),
            409: errResp('EmailAlreadyInUse'),
            429: errResp('RateLimitExceeded'),
          },
        },
      },
      '/api/login': {
        post: {
          summary: '로그인',
          requestBody: { content: { 'application/json': { schema: LoginInput } } },
          responses: {
            200: ok(z.object({ user: UserResponse })),
            400: errResp('ValidationError'),
            401: errResp('InvalidCredentials'),
            429: errResp('RateLimitExceeded'),
          },
        },
      },
      '/api/logout': {
        post: {
          summary: '로그아웃 (refresh token revoke + 쿠키 clear)',
          responses: { 204: { description: 'No Content' } },
        },
      },
      '/api/refresh': {
        post: {
          summary: 'Refresh token 회전 (새 access + refresh 발급)',
          responses: {
            200: ok(z.object({ user: UserResponse })),
            // 라우터가 반환 가능한 모든 401 사유를 명시.
            // error 값: 'NoRefreshToken' | 'InvalidRefreshToken' | 'UserNotFound'
            401: errResp('NoRefreshToken | InvalidRefreshToken | UserNotFound'),
          },
        },
      },
      '/api/me': {
        get: {
          summary: '현재 사용자 (JWT 인증 필요)',
          responses: {
            200: ok(z.object({ user: UserResponse })),
            401: errResp('Unauthorized'),
          },
        },
      },
      '/api/password/forgot': {
        post: {
          summary: '비밀번호 재설정 토큰 발급 (Issue #221)',
          description:
            '미등록 이메일도 동일 응답으로 enumeration 방지. dev 모드에선 응답에 token 포함.',
          requestBody: { content: { 'application/json': { schema: ForgotPasswordInput } } },
          responses: {
            200: ok(
              z.object({
                ok: z.boolean(),
                token: z.string().optional(),
                expiresAt: z.string().optional(),
              }),
            ),
            400: errResp('ValidationError'),
            429: errResp('RateLimitExceeded'),
          },
        },
      },
      '/api/password/reset': {
        post: {
          summary: '비밀번호 재설정 확정 (Issue #221)',
          description: '토큰 1회 소비 + 비밀번호 교체 + 기존 refresh 토큰 전체 revoke.',
          requestBody: { content: { 'application/json': { schema: ResetPasswordInput } } },
          responses: {
            200: ok(z.object({ ok: z.boolean() })),
            400: errResp('ValidationError | InvalidOrExpiredToken'),
            429: errResp('RateLimitExceeded'),
          },
        },
      },
    },
  });
