/**
 * 학교 인증 가드 미들웨어 통합 테스트 (#541).
 *
 * 커버리지:
 *  - 미인증 사용자의 mutation (POST/PATCH/DELETE) → 403 SchoolVerificationRequired
 *  - 인증 사용자의 mutation → 정상 통과 (회귀)
 *  - GET 라우트 — 미인증자도 통과 (PRD 디폴트)
 *  - feature flag OFF — guard no-op (기존 동작)
 *  - 토큰 없는 mutation — 가드는 통과 (개별 라우터 requireAuth 가 401)
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

const SECRET = process.env.JWT_SECRET;

const tokenFor = (sub, opts = {}) =>
  signJwt(
    {
      sub,
      email: `${sub}@get-it.cloud`,
      name: sub,
      ...(opts.schoolVerifiedAt ? { schoolVerifiedAt: opts.schoolVerifiedAt } : {}),
    },
    SECRET,
  );

const future = (h = 24) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

const createPostBody = () => ({
  title: '북문 마라탕',
  body: '같이 가요',
  meetAt: future(),
  capacity: 4,
  openChatUrl: 'https://open.kakao.com/o/test',
  tags: ['음식'],
});

describe('school-auth guard — feature flag ON (#541)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000, schoolAuthGuardEnabled: true });
  });

  describe('mutation 차단', () => {
    it('POST /api/posts — 미인증 사용자 → 403 SchoolVerificationRequired', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${tokenFor('unverified')}`)
        .send(createPostBody());
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('SchoolVerificationRequired');
      expect(res.body.message).toBe('학교 인증이 필요합니다.');
    });

    it('POST /api/applications — 미인증 사용자 → 403', async () => {
      // 먼저 인증된 alice 가 게시글을 만들어 두고, 미인증 bob 이 신청 시도.
      const verified = tokenFor('alice', { schoolVerifiedAt: '2026-05-21T10:00:00.000Z' });
      const create = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${verified}`)
        .send(createPostBody());
      expect(create.status).toBe(201);

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ postId: create.body.post.id });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('SchoolVerificationRequired');
    });

    it('PATCH /api/posts/:id — 미인증 사용자 → 403 (본인 게시글이어도)', async () => {
      // 가드 OFF 로 게시글 만든 뒤, ON 인 app 으로 PATCH — 본 테스트에선 어차피
      // mutation 전부 403 되므로 path 매칭만 검증 (id 는 더미).
      const res = await request(app)
        .patch('/api/posts/some-id')
        .set('Authorization', `Bearer ${tokenFor('unverified')}`)
        .send({ title: 'x' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('SchoolVerificationRequired');
    });

    it('DELETE /api/posts/:id — 미인증 사용자 → 403', async () => {
      const res = await request(app)
        .delete('/api/posts/some-id')
        .set('Authorization', `Bearer ${tokenFor('unverified')}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('SchoolVerificationRequired');
    });

    it('schoolVerifiedAt 이 있는 사용자 — 정상 통과 (회귀)', async () => {
      const verified = tokenFor('alice', { schoolVerifiedAt: '2026-05-21T10:00:00.000Z' });
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${verified}`)
        .send(createPostBody());
      expect(res.status).toBe(201);
      expect(res.body.post.id).toBeTruthy();
    });
  });

  describe('GET 통과 (PRD: 둘러보기 OK)', () => {
    it('GET /api/posts — 미인증자도 200', async () => {
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${tokenFor('unverified')}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/posts — 비로그인도 200', async () => {
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
    });
  });

  describe('가드는 학교 인증만 책임 — 토큰 부재는 라우터 책임', () => {
    it('POST /api/posts — 토큰 없음 → 401 (가드 통과 → requireAuth 가 401)', async () => {
      const res = await request(app).post('/api/posts').send(createPostBody());
      expect(res.status).toBe(401);
    });

    it('POST /api/posts — invalid JWT → 401 (가드 통과 → requireAuth 가 401)', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer not-a-real-token`)
        .send(createPostBody());
      expect(res.status).toBe(401);
    });
  });
});

describe('school-auth guard — feature flag OFF (#541)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeEach(() => {
    app = createApp({ rateLimitMax: 100_000, schoolAuthGuardEnabled: false });
  });

  it('미인증 사용자 POST → 가드 통과 (기존 동작, 201)', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenFor('unverified')}`)
      .send(createPostBody());
    expect(res.status).toBe(201);
  });

  it('GET 도 그대로', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
  });
});
