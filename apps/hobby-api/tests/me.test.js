/**
 * /api/me/* + 새 P1 동작 통합 테스트 (#210/#211/#212/#228/#229/#230).
 *
 * 커버리지:
 *  - GET /api/me/posts: 본인 게시글 (CLOSED 포함), 비인증 401
 *  - GET /api/me/applications: 본인 신청 + post join
 *  - GET /api/posts: 과거 meetAt 자동 제외 (#211)
 *  - GET /api/posts: q / timeWindow 서버 필터 (#229)
 *  - GET /api/posts/:id: myApplication 포함 (#212)
 *  - POST /api/posts: owner.nickname 직렬화 (#210)
 *  - POST /api/applications: 과거 meetAt → 422 PostExpired (#211)
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { meetAtRangeFor } from '../src/lib/timeWindow.js';

import './setup.js';
import { memDb } from './fake-prisma.js';

/** 테스트에서 "오늘 안쪽" 시각을 안정적으로 얻기 위한 헬퍼. */
const meetAtRangeForToday = (now) => meetAtRangeFor('today', now);

const SECRET = process.env.JWT_SECRET;
const tokenFor = (sub, name = sub) => signJwt({ sub, email: `${sub}@x.com`, name }, SECRET);
const future = (h) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
const validBody = (overrides = {}) => ({
  title: '북문 마라탕 3명',
  body: 'body',
  meetAt: future(24),
  capacity: 3,
  openChatUrl: 'https://open.kakao.com/o/test',
  tags: ['음식'],
  ...overrides,
});

const createAs = (app, sub, name, overrides = {}) =>
  request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${tokenFor(sub, name)}`)
    .send(validBody(overrides));

describe('hobby-api P1 새 동작', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  describe('owner.nickname 직렬화 (#210)', () => {
    it('POST /api/posts 응답에 owner.nickname = JWT name', async () => {
      const res = await createAs(app, 'alice-id', 'Alice K');
      expect(res.status).toBe(201);
      expect(res.body.post.owner).toEqual({ nickname: 'Alice K' });
    });

    it('GET /api/posts 리스트 카드도 owner.nickname 포함', async () => {
      await createAs(app, 'alice', 'Alice Cho');
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
      expect(res.body.items[0].owner).toEqual({ nickname: 'Alice Cho' });
    });

    it('ownerName 이 null 이면 owner 키 자체 생략 (FE 에서 익명 fallback)', async () => {
      // 시드처럼 ownerName 없는 row 를 fake-prisma 에 직접 박아 시뮬레이션.
      memDb.posts.set('legacy-1', {
        id: 'legacy-1',
        ownerId: 'legacy-owner',
        ownerName: null,
        title: 'legacy',
        body: 'b',
        meetAt: new Date(Date.now() + 3600_000),
        capacity: 3,
        currentCapacity: 0,
        openChatUrl: 'https://open.kakao.com/o/x',
        status: 'RECRUITING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await request(app).get('/api/posts/legacy-1');
      expect(res.status).toBe(200);
      expect(res.body.post.owner).toBeUndefined();
    });
  });

  describe('과거 meetAt 가드 (#211)', () => {
    it('GET /api/posts 가 과거 meetAt 게시글 자동 제외', async () => {
      // future post — 노출
      await createAs(app, 'alice');
      // past post — fake-prisma 직접 박기 (Zod 가 POST 단에서 거부하므로 우회).
      memDb.posts.set('past-1', {
        id: 'past-1',
        ownerId: 'alice',
        ownerName: 'alice',
        title: '어제 모임',
        body: 'b',
        meetAt: new Date(Date.now() - 3600_000),
        capacity: 3,
        currentCapacity: 0,
        openChatUrl: 'https://open.kakao.com/o/p',
        status: 'RECRUITING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
      const titles = res.body.items.map((i) => i.title);
      expect(titles).toContain('북문 마라탕 3명');
      expect(titles).not.toContain('어제 모임');
    });

    it('POST /api/applications → 과거 meetAt 게시글이면 422 PostExpired', async () => {
      memDb.posts.set('past-2', {
        id: 'past-2',
        ownerId: 'alice',
        ownerName: 'alice',
        title: 'past',
        body: 'b',
        meetAt: new Date(Date.now() - 3600_000),
        capacity: 3,
        currentCapacity: 0,
        openChatUrl: 'https://open.kakao.com/o/p',
        status: 'RECRUITING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ postId: 'past-2' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('PostExpired');
    });
  });

  describe('GET /api/posts/:id myApplication (#212)', () => {
    it('신청자 본인 GET → myApplication.id 포함', async () => {
      const c = await createAs(app, 'alice');
      const id = c.body.post.id;
      const apply = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ postId: id });
      expect(apply.status).toBe(201);
      const appId = apply.body.application.id;

      const res = await request(app)
        .get(`/api/posts/${id}`)
        .set('Authorization', `Bearer ${tokenFor('bob')}`);
      expect(res.status).toBe(200);
      expect(res.body.post.myApplication).toMatchObject({ id: appId });
    });

    it('비신청자 GET → myApplication 미포함', async () => {
      const c = await createAs(app, 'alice');
      const res = await request(app)
        .get(`/api/posts/${c.body.post.id}`)
        .set('Authorization', `Bearer ${tokenFor('bob')}`);
      expect(res.status).toBe(200);
      expect(res.body.post.myApplication).toBeUndefined();
    });

    it('비로그인 GET → myApplication 미포함', async () => {
      const c = await createAs(app, 'alice');
      const res = await request(app).get(`/api/posts/${c.body.post.id}`);
      expect(res.status).toBe(200);
      expect(res.body.post.myApplication).toBeUndefined();
    });
  });

  describe('GET /api/posts 서버 필터 (#229)', () => {
    it('q 검색 — title/body 부분 일치 (case-insensitive)', async () => {
      await createAs(app, 'alice', 'alice', { title: '북문 마라탕' });
      await createAs(app, 'alice', 'alice', { title: '도서관 스터디', body: '시험기간 함께' });
      const res = await request(app).get('/api/posts').query({ q: '마라탕' });
      expect(res.status).toBe(200);
      expect(res.body.items.map((i) => i.title)).toEqual(['북문 마라탕']);
    });

    it('timeWindow=today — 오늘 모임만', async () => {
      // 시간대 안정성: now+1h 는 23시대에 다음날 롤오버되어 flaky.
      // meetAtRangeFor() 가 보는 "오늘"은 KST 자정 boundary 라서
      // 아무 보장된 미래 시각을 KST 자정 보다 안쪽에 두는 게 까다롭다.
      // → range 의 중간값이 과거가 될 수 있음 (KST 23시 등). #211 가드 (meetAt > now) 도 통과해야
      //   하므로 [max(range.gte, now+1m), range.lt) 안에서 안전한 시각을 잡는다.
      const now = new Date();
      const range = meetAtRangeForToday(now);
      const safeStart = Math.max(range.gte.getTime(), now.getTime() + 60_000);
      // 안전 시각이 range.lt 를 넘어가면 (KST 자정 직전 케이스) 테스트 자체가 의미 없어지므로 skip.
      if (safeStart >= range.lt.getTime()) {
        // KST 자정 직전 — today 윈도우가 거의 끝남. flaky 회피.
        return;
      }
      const todayLater = new Date((safeStart + range.lt.getTime()) / 2);
      const nextWeek = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

      memDb.posts.set('t1', {
        id: 't1',
        ownerId: 'alice',
        ownerName: 'alice',
        title: '오늘',
        body: 'b',
        meetAt: todayLater,
        capacity: 3,
        currentCapacity: 0,
        openChatUrl: 'https://open.kakao.com/o/x',
        status: 'RECRUITING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      memDb.posts.set('w1', {
        id: 'w1',
        ownerId: 'alice',
        ownerName: 'alice',
        title: '다음주',
        body: 'b',
        meetAt: nextWeek,
        capacity: 3,
        currentCapacity: 0,
        openChatUrl: 'https://open.kakao.com/o/x',
        status: 'RECRUITING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await request(app).get('/api/posts').query({ timeWindow: 'today' });
      expect(res.status).toBe(200);
      const titles = res.body.items.map((i) => i.title);
      expect(titles).toContain('오늘');
      expect(titles).not.toContain('다음주');
    });
  });

  describe('GET /api/me (현재 사용자)', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
    });

    it('인증 → 200 + user 페이로드', async () => {
      const res = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${tokenFor('alice-id', 'Alice K')}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        sub: 'alice-id',
        email: 'alice-id@x.com',
        name: 'Alice K',
      });
    });
  });

  describe('GET /api/me/* (#228)', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).get('/api/me/posts');
      expect(res.status).toBe(401);
    });

    it('내 게시글만 (CLOSED 포함)', async () => {
      await createAs(app, 'alice', 'alice', { title: 'a1' });
      // 다른 user 게시글
      await createAs(app, 'bob', 'bob', { title: 'b1' });
      // alice 게시글을 CLOSED 로 강제 변경
      const created = await createAs(app, 'alice', 'alice', { title: 'a2' });
      memDb.posts.set(created.body.post.id, {
        ...memDb.posts.get(created.body.post.id),
        status: 'CLOSED',
      });

      const res = await request(app)
        .get('/api/me/posts')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      const titles = res.body.items.map((i) => i.title).sort();
      expect(titles).toEqual(['a1', 'a2']);
      // 본인 게시글이므로 openChatUrl 노출.
      expect(res.body.items[0].openChatUrl).toBeDefined();
    });

    it('내가 신청한 모임 + post 임베드', async () => {
      const c = await createAs(app, 'alice', 'alice');
      const id = c.body.post.id;
      const apply = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ postId: id });
      expect(apply.status).toBe(201);

      const res = await request(app)
        .get('/api/me/applications')
        .set('Authorization', `Bearer ${tokenFor('bob')}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].post.title).toBe('북문 마라탕 3명');
      expect(res.body.items[0].post.myApplication).toMatchObject({
        id: apply.body.application.id,
      });
    });
  });

  describe('알림 PATCH/read-all (#229)', () => {
    it('PATCH /api/notifications/:id/read — 본인 readAt 채움', async () => {
      // alice 의 알림을 fake-prisma 에 직접 박기.
      memDb.notifications.set('n1', {
        id: 'n1',
        userId: 'alice',
        postId: null,
        kind: 'MATCH_FULL',
        message: 'hi',
        createdAt: new Date(),
        readAt: null,
      });
      const res = await request(app)
        .patch('/api/notifications/n1/read')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(204);
      expect(memDb.notifications.get('n1').readAt).toBeInstanceOf(Date);
    });

    it('PATCH 타인 알림 → 404', async () => {
      memDb.notifications.set('n2', {
        id: 'n2',
        userId: 'alice',
        postId: null,
        kind: 'MATCH_FULL',
        message: 'hi',
        createdAt: new Date(),
        readAt: null,
      });
      const res = await request(app)
        .patch('/api/notifications/n2/read')
        .set('Authorization', `Bearer ${tokenFor('bob')}`);
      expect(res.status).toBe(404);
    });

    it('POST /api/notifications/read-all — 본인 unread 일괄', async () => {
      memDb.notifications.set('n3', {
        id: 'n3',
        userId: 'alice',
        postId: null,
        kind: 'MATCH_FULL',
        message: 'hi',
        createdAt: new Date(),
        readAt: null,
      });
      memDb.notifications.set('n4', {
        id: 'n4',
        userId: 'alice',
        postId: null,
        kind: 'MATCH_FULL',
        message: 'hi2',
        createdAt: new Date(),
        readAt: null,
      });
      memDb.notifications.set('n5', {
        id: 'n5',
        userId: 'bob',
        postId: null,
        kind: 'MATCH_FULL',
        message: 'other',
        createdAt: new Date(),
        readAt: null,
      });
      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);
      expect(memDb.notifications.get('n5').readAt).toBeNull();
    });

    it('GET /api/notifications — unreadCount 포함', async () => {
      memDb.notifications.set('nA', {
        id: 'nA',
        userId: 'alice',
        postId: null,
        kind: 'MATCH_FULL',
        message: 'x',
        createdAt: new Date(),
        readAt: null,
      });
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(1);
    });
  });
});
