/**
 * hobby-api 오픈채팅 프라이버시 + 알림 통합 테스트 (#36).
 *
 * 핵심 정책 (회귀 방지):
 *  - openChatUrl 노출 조건: (방장) OR (신청완료 + status=FULL).
 *  - 그 외 응답에는 키 자체가 없어야 함 (undefined). null/마스킹 문자열도 금지.
 *  - list 응답은 어떤 경우에도 항상 미포함.
 *  - 매칭 FULL 전이 시 신청자에게 MATCH_FULL 알림 자동 생성.
 *  - 알림 조회는 본인 것만.
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
  capacity: 2,
  openChatUrl: 'https://open.kakao.com/o/test',
  tags: ['음식'],
  ...overrides,
});

const createPostAs = (app, owner, overrides = {}) =>
  request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${tokenFor(owner)}`)
    .send(postBody(overrides));

const applyAs = (app, user, postId) =>
  request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ postId });

const detail = (app, id, user) => {
  const req = request(app).get(`/api/posts/${id}`);
  if (user) req.set('Authorization', `Bearer ${tokenFor(user)}`);
  return req;
};

describe('hobby-api openChatUrl 프라이버시 정책 (#36)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  describe('GET /api/posts/:id — detail 응답', () => {
    it('비로그인 + RECRUITING → 키 자체가 응답에 없음', async () => {
      const c = await createPostAs(app, 'alice');
      const res = await detail(app, c.body.post.id);
      expect(res.status).toBe(200);
      expect('openChatUrl' in res.body.post).toBe(false);
    });

    it('비신청자 + RECRUITING → 키 없음', async () => {
      const c = await createPostAs(app, 'alice');
      const res = await detail(app, c.body.post.id, 'bob');
      expect(res.status).toBe(200);
      expect('openChatUrl' in res.body.post).toBe(false);
    });

    it('비신청자 + FULL → 키 없음 (신청 안 한 외부인은 절대 못 봄)', async () => {
      const c = await createPostAs(app, 'alice', { capacity: 2 });
      const id = c.body.post.id;
      await applyAs(app, 'bob', id);
      await applyAs(app, 'carol', id); // FULL 전이
      expect(memDb.posts.get(id).status).toBe('FULL');

      const res = await detail(app, id, 'dave');
      expect(res.status).toBe(200);
      expect(res.body.post.status).toBe('FULL');
      expect('openChatUrl' in res.body.post).toBe(false);
    });

    it('방장 + RECRUITING → 항상 노출', async () => {
      const c = await createPostAs(app, 'alice');
      const res = await detail(app, c.body.post.id, 'alice');
      expect(res.status).toBe(200);
      expect(res.body.post.openChatUrl).toBe('https://open.kakao.com/o/test');
    });

    it('방장 + FULL → 노출', async () => {
      const c = await createPostAs(app, 'alice', { capacity: 2 });
      const id = c.body.post.id;
      await applyAs(app, 'bob', id);
      await applyAs(app, 'carol', id);
      const res = await detail(app, id, 'alice');
      expect(res.body.post.openChatUrl).toBe('https://open.kakao.com/o/test');
    });

    it('신청자 + RECRUITING → 키 없음 (아직 마감 전)', async () => {
      const c = await createPostAs(app, 'alice', { capacity: 3 });
      const id = c.body.post.id;
      await applyAs(app, 'bob', id);
      const res = await detail(app, id, 'bob');
      expect(res.status).toBe(200);
      expect(memDb.posts.get(id).status).toBe('RECRUITING');
      expect('openChatUrl' in res.body.post).toBe(false);
    });

    it('신청자 + FULL → 노출', async () => {
      const c = await createPostAs(app, 'alice', { capacity: 2 });
      const id = c.body.post.id;
      await applyAs(app, 'bob', id);
      await applyAs(app, 'carol', id);
      expect(memDb.posts.get(id).status).toBe('FULL');

      const res = await detail(app, id, 'bob');
      expect(res.status).toBe(200);
      expect(res.body.post.openChatUrl).toBe('https://open.kakao.com/o/test');
    });

    it('snapshot — 비신청자 응답에 openChatUrl 키 없음', async () => {
      const c = await createPostAs(app, 'alice');
      const res = await detail(app, c.body.post.id, 'bob');
      const keys = Object.keys(res.body.post).sort();
      expect(keys).not.toContain('openChatUrl');
      expect(keys).toMatchInlineSnapshot(`
        [
          "body",
          "capacity",
          "createdAt",
          "currentCapacity",
          "id",
          "meetAt",
          "owner",
          "ownerId",
          "status",
          "tags",
          "title",
          "updatedAt",
        ]
      `);
    });
  });

  describe('GET /api/posts (list) — 항상 마스킹', () => {
    it('방장이 list 호출해도 키 없음', async () => {
      await createPostAs(app, 'alice');
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      for (const item of res.body.items) {
        expect('openChatUrl' in item).toBe(false);
      }
    });
  });
});

describe('hobby-api 알림 자동 생성 (#36)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  it('매칭 FULL 전이 시 — 방장 + 모든 신청자에게 MATCH_FULL 알림 생성', async () => {
    const c = await createPostAs(app, 'alice', { capacity: 2 });
    const id = c.body.post.id;
    await applyAs(app, 'bob', id);
    expect(memDb.notifications.size).toBe(0); // 아직 FULL 아님

    await applyAs(app, 'carol', id); // FULL 전이
    expect(memDb.posts.get(id).status).toBe('FULL');

    // 방장(alice) + 신청자(bob, carol) 3명 모두에게 알림.
    const notifs = [...memDb.notifications.values()].filter((n) => n.postId === id);
    const userIds = notifs.map((n) => n.userId).sort();
    expect(userIds).toEqual(['alice', 'bob', 'carol']);
    for (const n of notifs) {
      expect(n.kind).toBe('MATCH_FULL');
      expect(n.readAt).toBeNull();
    }
  });

  it('RECRUITING 상태에선 알림 없음', async () => {
    const c = await createPostAs(app, 'alice', { capacity: 3 });
    const id = c.body.post.id;
    await applyAs(app, 'bob', id);
    expect(memDb.notifications.size).toBe(0);
  });
});

describe('GET /api/notifications (#36)', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  it('비인증 → 401', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('빈 상태 → 200 + items=[]', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor('bob')}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('본인 알림만 조회 — 타 유저 알림은 응답에 포함 X', async () => {
    const c = await createPostAs(app, 'alice', { capacity: 2 });
    const id = c.body.post.id;
    await applyAs(app, 'bob', id);
    await applyAs(app, 'carol', id); // FULL → 3명 알림 생성

    const resBob = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor('bob')}`);
    expect(resBob.status).toBe(200);
    expect(resBob.body.items).toHaveLength(1);
    expect(resBob.body.items[0]).toMatchObject({
      userId: 'bob',
      postId: id,
      kind: 'MATCH_FULL',
    });

    const resCarol = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor('carol')}`);
    expect(resCarol.body.items).toHaveLength(1);
    expect(resCarol.body.items[0].userId).toBe('carol');

    // dave 는 무관 → 빈 리스트
    const resDave = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor('dave')}`);
    expect(resDave.body.items).toEqual([]);
  });

  it('유효하지 않은 cursor → 400 ValidationError (Prisma 500 회귀 방지)', async () => {
    const res = await request(app)
      .get('/api/notifications?cursor=nonexistent_id')
      .set('Authorization', `Bearer ${tokenFor('bob')}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('타인 알림의 cursor → 400 (권한 우회 차단)', async () => {
    // alice 가 게시글 만들고 FULL → 본인 알림 1개 보유.
    const c = await createPostAs(app, 'alice', { capacity: 2 });
    await applyAs(app, 'bob', c.body.post.id);
    await applyAs(app, 'carol', c.body.post.id);

    const aliceList = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor('alice')}`);
    const aliceNotifId = aliceList.body.items[0].id;

    // dave 가 alice 알림 id 를 cursor 로 박아도 거부.
    const res = await request(app)
      .get(`/api/notifications?cursor=${aliceNotifId}`)
      .set('Authorization', `Bearer ${tokenFor('dave')}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('최신순 정렬 (createdAt desc)', async () => {
    // alice 가 게시글 2개 만들고 둘 다 FULL 까지.
    const c1 = await createPostAs(app, 'alice', { capacity: 2 });
    await applyAs(app, 'bob', c1.body.post.id);
    await applyAs(app, 'carol', c1.body.post.id);

    const c2 = await createPostAs(app, 'alice', { capacity: 2 });
    await applyAs(app, 'dave', c2.body.post.id);
    await applyAs(app, 'eve', c2.body.post.id);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor('alice')}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    // 가장 최근 알림이 먼저.
    const t0 = new Date(res.body.items[0].createdAt).getTime();
    const t1 = new Date(res.body.items[1].createdAt).getTime();
    expect(t0).toBeGreaterThanOrEqual(t1);
  });
});
