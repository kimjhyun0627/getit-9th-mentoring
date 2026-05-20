/**
 * hobby-api 매칭 신청 (apply/cancel) + race-safe transaction 통합 테스트.
 *
 * 커버리지:
 *  - POST /api/applications
 *    - 비인증 → 401
 *    - 정상 신청 → 201 + currentCapacity +1
 *    - 정원 도달 → status=FULL 전이
 *    - 정원 초과 신청 → 422 PostFull
 *    - 같은 유저 중복 신청 → 409 AlreadyApplied
 *    - 본인(게시글 owner) 신청 → 409 OwnerCannotApply
 *    - CLOSED/FULL 게시글 신청 → 422 PostNotOpen
 *    - 미존재 게시글 → 404
 *    - **Race condition**: 남은 1자리에 5명 동시 신청 → 정확히 1명만 201
 *
 *  - DELETE /api/applications/:id
 *    - 비인증 → 401
 *    - 본인 신청 취소 → 204 + currentCapacity -1
 *    - 정원 마감 상태에서 취소 → status=RECRUITING 롤백
 *    - 타인 신청 취소 시도 → 403
 *    - 미존재 신청 → 404
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { memDb } from './setup.js';

const SECRET = process.env.JWT_SECRET;
const tokenFor = (sub) => signJwt({ sub, email: `${sub}@get-it.cloud`, name: sub }, SECRET);
const future = (h = 24) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

const postBody = (overrides = {}) => ({
  title: '북문 마라탕',
  body: '오늘 저녁 6시',
  meetAt: future(),
  capacity: 3,
  openChatUrl: 'https://open.kakao.com/o/test',
  tags: ['음식'],
  ...overrides,
});

const createPostAs = async (app, owner, overrides = {}) =>
  request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${tokenFor(owner)}`)
    .send(postBody(overrides));

const applyAs = (app, user, postId) =>
  request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ postId });

const cancelAs = (app, user, appId) =>
  request(app)
    .delete(`/api/applications/${appId}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`);

describe('hobby-api applications', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  describe('POST /api/applications', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).post('/api/applications').send({ postId: 'whatever' });
      expect(res.status).toBe(401);
    });

    it('postId 빈 문자열 → 400', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ postId: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('미존재 게시글 → 404', async () => {
      const res = await applyAs(app, 'bob', 'nope');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('PostNotFound');
    });

    it('정상 신청 → 201 + currentCapacity +1', async () => {
      const created = await createPostAs(app, 'alice');
      const postId = created.body.post.id;
      const res = await applyAs(app, 'bob', postId);
      expect(res.status).toBe(201);
      expect(res.body.application).toMatchObject({ postId, userId: 'bob' });
      // currentCapacity 1 증가
      expect(memDb.posts.get(postId).currentCapacity).toBe(1);
      expect(memDb.posts.get(postId).status).toBe('RECRUITING');
    });

    it('정원 도달 → status FULL 전이', async () => {
      const created = await createPostAs(app, 'alice', { capacity: 2 });
      const postId = created.body.post.id;
      const r1 = await applyAs(app, 'bob', postId);
      expect(r1.status).toBe(201);
      const r2 = await applyAs(app, 'carol', postId);
      expect(r2.status).toBe(201);
      // 2/2 = full
      expect(memDb.posts.get(postId).currentCapacity).toBe(2);
      expect(memDb.posts.get(postId).status).toBe('FULL');
    });

    it('정원 초과 신청 → 422 PostFull', async () => {
      // capacity=2 채운 뒤 3번째 신청
      const created = await createPostAs(app, 'alice', { capacity: 2 });
      const postId = created.body.post.id;
      await applyAs(app, 'bob', postId);
      await applyAs(app, 'carol', postId);
      const res = await applyAs(app, 'dave', postId);
      // FULL 전이 후라 PostNotOpen 또는 PostFull. 라우터 분기상 PostNotOpen 이 먼저.
      expect(res.status).toBe(422);
      expect(['PostFull', 'PostNotOpen']).toContain(res.body.error);
    });

    it('같은 유저 중복 신청 → 409 AlreadyApplied', async () => {
      const created = await createPostAs(app, 'alice');
      const postId = created.body.post.id;
      const r1 = await applyAs(app, 'bob', postId);
      expect(r1.status).toBe(201);
      const r2 = await applyAs(app, 'bob', postId);
      expect(r2.status).toBe(409);
      expect(r2.body.error).toBe('AlreadyApplied');
      // capacity 는 1 그대로 (중복 신청으로 늘어나면 안 됨)
      expect(memDb.posts.get(postId).currentCapacity).toBe(1);
    });

    it('본인(owner) 신청 → 409 OwnerCannotApply', async () => {
      const created = await createPostAs(app, 'alice');
      const postId = created.body.post.id;
      const res = await applyAs(app, 'alice', postId);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('OwnerCannotApply');
      expect(memDb.posts.get(postId).currentCapacity).toBe(0);
    });

    it('FULL 게시글 신청 → 422 PostNotOpen', async () => {
      const created = await createPostAs(app, 'alice', { capacity: 2 });
      const postId = created.body.post.id;
      await applyAs(app, 'bob', postId);
      await applyAs(app, 'carol', postId); // FULL

      const res = await applyAs(app, 'dave', postId);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('PostNotOpen');
    });

    // Race condition — 핵심 acceptance criterion.
    // 정원 2, 1명 먼저 채움 → 남은 1자리에 5명 동시 신청 → 정확히 1명만 성공.
    it('Race condition: 남은 1자리에 5명 동시 신청 → 정확히 1명만 성공', async () => {
      const created = await createPostAs(app, 'alice', { capacity: 2 });
      const postId = created.body.post.id;
      // 1자리 미리 채워서 capacity 1/2 상태로 만듦.
      const seed = await applyAs(app, 'seed', postId);
      expect(seed.status).toBe(201);
      expect(memDb.posts.get(postId).currentCapacity).toBe(1);

      // 남은 1자리에 5명 동시 신청.
      const users = ['u1', 'u2', 'u3', 'u4', 'u5'];
      const results = await Promise.all(users.map((u) => applyAs(app, u, postId)));
      const successes = results.filter((r) => r.status === 201);
      const rejects = results.filter((r) => r.status !== 201);
      expect(successes).toHaveLength(1);
      expect(rejects).toHaveLength(4);
      // 모두 422 (PostFull) 또는 PostNotOpen (먼저 1명이 잡고 FULL 전이 후).
      for (const r of rejects) {
        expect(r.status).toBe(422);
        expect(['PostFull', 'PostNotOpen']).toContain(r.body.error);
      }
      // 최종 2/2 — 정원 정확히 채워짐 (over-counted 면 안 됨).
      expect(memDb.posts.get(postId).currentCapacity).toBe(2);
      expect(memDb.posts.get(postId).status).toBe('FULL');
      expect(memDb.applications.size).toBe(2);
    });
  });

  describe('DELETE /api/applications/:id', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).delete('/api/applications/whatever');
      expect(res.status).toBe(401);
    });

    it('미존재 신청 → 404', async () => {
      const res = await cancelAs(app, 'bob', 'nope');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ApplicationNotFound');
    });

    it('본인 신청 취소 → 204 + currentCapacity -1', async () => {
      const created = await createPostAs(app, 'alice');
      const postId = created.body.post.id;
      const apply = await applyAs(app, 'bob', postId);
      expect(apply.status).toBe(201);
      expect(memDb.posts.get(postId).currentCapacity).toBe(1);

      const del = await cancelAs(app, 'bob', apply.body.application.id);
      expect(del.status).toBe(204);
      expect(memDb.posts.get(postId).currentCapacity).toBe(0);
      expect(memDb.applications.size).toBe(0);
    });

    it('FULL 상태에서 취소 → status RECRUITING 으로 롤백', async () => {
      const created = await createPostAs(app, 'alice', { capacity: 2 });
      const postId = created.body.post.id;
      const a1 = await applyAs(app, 'bob', postId);
      await applyAs(app, 'carol', postId);
      expect(memDb.posts.get(postId).status).toBe('FULL');

      const del = await cancelAs(app, 'bob', a1.body.application.id);
      expect(del.status).toBe(204);
      expect(memDb.posts.get(postId).currentCapacity).toBe(1);
      expect(memDb.posts.get(postId).status).toBe('RECRUITING');
    });

    it('타인 신청 취소 시도 → 403', async () => {
      const created = await createPostAs(app, 'alice');
      const postId = created.body.post.id;
      const apply = await applyAs(app, 'bob', postId);
      const del = await cancelAs(app, 'carol', apply.body.application.id);
      expect(del.status).toBe(403);
      expect(del.body.error).toBe('Forbidden');
      // capacity 변화 없어야 함
      expect(memDb.posts.get(postId).currentCapacity).toBe(1);
      expect(memDb.applications.size).toBe(1);
    });

    it('취소 후 재신청 가능', async () => {
      const created = await createPostAs(app, 'alice');
      const postId = created.body.post.id;
      const a1 = await applyAs(app, 'bob', postId);
      await cancelAs(app, 'bob', a1.body.application.id);
      const a2 = await applyAs(app, 'bob', postId);
      expect(a2.status).toBe(201);
      expect(memDb.posts.get(postId).currentCapacity).toBe(1);
    });
  });
});
