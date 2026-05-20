/**
 * hobby-api 신규 mutation 엔드포인트 통합 테스트 — Phase 6c P2.
 *
 * 커버리지:
 *  - PATCH  /api/posts/:id             — 방장 수정 (#333)
 *  - POST   /api/posts/:id/close       — CLOSED 전이 (#244)
 *  - GET    /api/posts/:id/applicants  — 신청자 목록 (#245)
 *  - POST   /api/posts/:id/no-shows    — 노쇼 신고 (#247)
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

const SECRET = process.env.JWT_SECRET;
const tokenFor = (sub) => signJwt({ sub, email: `${sub}@get-it.cloud`, name: sub }, SECRET);
const future = (h = 24) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
const past = (h = 1) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

const createPost = async (app, owner, overrides = {}) =>
  request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${tokenFor(owner)}`)
    .send({
      title: '북문 마라탕',
      body: '같이 가요',
      meetAt: future(),
      capacity: 4,
      openChatUrl: 'https://open.kakao.com/o/test',
      tags: ['음식'],
      ...overrides,
    });

describe('hobby-api posts mutations', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  describe('PATCH /api/posts/:id (#333)', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).patch('/api/posts/xxx').send({ title: 'new' });
      expect(res.status).toBe(401);
    });

    it('타인 게시글 수정 → 403', async () => {
      const create = await createPost(app, 'alice');
      const res = await request(app)
        .patch(`/api/posts/${create.body.post.id}`)
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ title: '훔쳐쓰기' });
      expect(res.status).toBe(403);
    });

    it('미존재 → 404', async () => {
      const res = await request(app)
        .patch('/api/posts/nonexistent')
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ title: '제목 수정' });
      expect(res.status).toBe(404);
    });

    it('빈 body → 400 ValidationError', async () => {
      const create = await createPost(app, 'alice');
      const res = await request(app)
        .patch(`/api/posts/${create.body.post.id}`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('정상 → 200 + 변경된 필드 반영', async () => {
      const create = await createPost(app, 'alice');
      const res = await request(app)
        .patch(`/api/posts/${create.body.post.id}`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ title: '제목 고쳤어요', body: '본문도 같이' });
      expect(res.status).toBe(200);
      expect(res.body.post.title).toBe('제목 고쳤어요');
      expect(res.body.post.body).toBe('본문도 같이');
    });

    it('CLOSED 게시글 수정 → 422 PostClosed', async () => {
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      await request(app)
        .post(`/api/posts/${id}/close`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      const res = await request(app)
        .patch(`/api/posts/${id}`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ title: '닫힌글 수정' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('PostClosed');
    });
  });

  describe('POST /api/posts/:id/close (#244)', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).post('/api/posts/x/close');
      expect(res.status).toBe(401);
    });

    it('타인 → 403', async () => {
      const create = await createPost(app, 'alice');
      const res = await request(app)
        .post(`/api/posts/${create.body.post.id}/close`)
        .set('Authorization', `Bearer ${tokenFor('bob')}`);
      expect(res.status).toBe(403);
    });

    it('정상 → 200 + status CLOSED', async () => {
      const create = await createPost(app, 'alice');
      const res = await request(app)
        .post(`/api/posts/${create.body.post.id}/close`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.post.status).toBe('CLOSED');
    });

    it('이미 CLOSED 면 멱등 200 + 같은 상태 유지', async () => {
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      await request(app)
        .post(`/api/posts/${id}/close`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      const res = await request(app)
        .post(`/api/posts/${id}/close`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.post.status).toBe('CLOSED');
    });
  });

  describe('GET /api/posts/:id/applicants (#245)', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).get('/api/posts/x/applicants');
      expect(res.status).toBe(401);
    });

    it('타인이 조회 → 403', async () => {
      const create = await createPost(app, 'alice');
      const res = await request(app)
        .get(`/api/posts/${create.body.post.id}/applicants`)
        .set('Authorization', `Bearer ${tokenFor('bob')}`);
      expect(res.status).toBe(403);
    });

    it('방장 조회 → 신청자 배열 + 누적 노쇼 카운트', async () => {
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      // bob, carol 신청
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ postId: id });
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenFor('carol')}`)
        .send({ postId: id });

      const res = await request(app)
        .get(`/api/posts/${id}/applicants`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      const ids = res.body.items.map((i) => i.userId).sort();
      expect(ids).toEqual(['bob', 'carol']);
      // 첫 모임이라 노쇼 카운트 모두 0.
      expect(res.body.items.every((i) => i.noShowCount === 0)).toBe(true);
    });
  });

  describe('POST /api/posts/:id/no-shows (#247)', () => {
    it('비인증 → 401', async () => {
      const res = await request(app)
        .post('/api/posts/x/no-shows')
        .send({ applicantIds: ['bob'] });
      expect(res.status).toBe(401);
    });

    it('타인 → 403', async () => {
      const create = await createPost(app, 'alice');
      const res = await request(app)
        .post(`/api/posts/${create.body.post.id}/no-shows`)
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ applicantIds: ['carol'] });
      expect(res.status).toBe(403);
    });

    it('빈 applicantIds → 400', async () => {
      const create = await createPost(app, 'alice');
      const res = await request(app)
        .post(`/api/posts/${create.body.post.id}/no-shows`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ applicantIds: [] });
      expect(res.status).toBe(400);
    });

    it('아직 끝나지 않은 모임 → 422 PostNotEnded', async () => {
      const create = await createPost(app, 'alice', { meetAt: future(48) });
      const res = await request(app)
        .post(`/api/posts/${create.body.post.id}/no-shows`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ applicantIds: ['bob'] });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('PostNotEnded');
    });

    it('정상 → 200 + noshow=true 적용 + 누적 카운트 증가', async () => {
      // meetAt 을 미래로 만든 뒤 직접 과거로 우회.
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ postId: id });
      const { memDb } = await import('./setup.js');
      const row = memDb.posts.get(id);
      memDb.posts.set(id, { ...row, meetAt: new Date(past(2)) });

      const res = await request(app)
        .post(`/api/posts/${id}/no-shows`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ applicantIds: ['bob'] });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(1);

      // 후속 GET 으로 noshow 표기 확인.
      const apps = await request(app)
        .get(`/api/posts/${id}/applicants`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      const bob = apps.body.items.find((i) => i.userId === 'bob');
      expect(bob.noShow).toBe(true);
      expect(bob.noShowCount).toBe(1);
    });
  });
});
