/**
 * hobby-api 게시글 CRUD + 페이지네이션 + 태그 통합 테스트 (supertest).
 *
 * 커버리지:
 *  - POST /api/posts: 정상 / 비인증 401 / 검증 400 / 태그 다대다
 *  - GET  /api/posts: 페이지네이션 (cursor), 태그/상태 필터, openChatUrl 마스킹
 *  - GET  /api/posts/:id: 정상 / 미존재 404 / openChatUrl owner 노출 vs 비owner 마스킹
 *  - DELETE /api/posts/:id: 본인 200 / 타인 403 / 비인증 401 / 미존재 404
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

const SECRET = process.env.JWT_SECRET;

/** Bearer 토큰 생성 헬퍼 */
const tokenFor = (sub, email = `${sub}@get-it.cloud`, name = sub) =>
  signJwt({ sub, email, name }, SECRET);

const future = (h = 24) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

const validBody = (overrides = {}) => ({
  title: '북문 마라탕 3명',
  body: '오늘 저녁 6시',
  meetAt: future(),
  capacity: 3,
  openChatUrl: 'https://open.kakao.com/o/test',
  tags: ['음식', '맛집'],
  ...overrides,
});

const createPost = async (app, ownerSub, overrides = {}) => {
  const token = tokenFor(ownerSub);
  return request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .send(validBody(overrides));
};

describe('hobby-api posts', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  describe('POST /api/posts', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).post('/api/posts').send(validBody());
      expect(res.status).toBe(401);
    });

    it('정상 → 201 + 게시글 본문 + 태그 포함', async () => {
      const res = await createPost(app, 'alice');
      expect(res.status).toBe(201);
      expect(res.body.post).toMatchObject({
        title: '북문 마라탕 3명',
        ownerId: 'alice',
        status: 'RECRUITING',
        currentCapacity: 0,
      });
      const names = res.body.post.tags.map((t) => t.name).sort();
      expect(names).toEqual(['맛집', '음식']);
    });

    it('타이틀 1자 → 400 ValidationError', async () => {
      const token = tokenFor('alice');
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody({ title: 'a' }));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('과거 meetAt → 400', async () => {
      const token = tokenFor('alice');
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody({ meetAt: new Date(Date.now() - 1000).toISOString() }));
      expect(res.status).toBe(400);
    });

    it('태그 중복 입력해도 한 번만 연결됨 (trim + 대소문자 무시)', async () => {
      const token = tokenFor('alice');
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody({ tags: ['Food', ' food ', 'FOOD', '맛집'] }));
      expect(res.status).toBe(201);
      const names = res.body.post.tags.map((t) => t.name).sort();
      // 'Food' / ' food ' / 'FOOD' 모두 정규화 → 'food' 한 row 로 합쳐짐.
      expect(names).toEqual(['food', '맛집']);
    });
  });

  describe('GET /api/posts (list)', () => {
    it('빈 DB → 빈 items + nextCursor null', async () => {
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.nextCursor).toBeNull();
    });

    it('cursor 페이지네이션 — 5개 생성 후 limit=2 로 3 페이지에 걸쳐 모두 회수', async () => {
      // 같은 ms 에 만들어지면 createdAt tie → id 로 tie-break (FakePrisma 도 동일 정렬).
      for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line no-await-in-loop
        await createPost(app, 'alice', { title: `post-${i}` });
      }
      const seen = new Set();
      let cursor = null;
      let pages = 0;
      do {
        const url = cursor ? `/api/posts?limit=2&cursor=${cursor}` : '/api/posts?limit=2';
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app).get(url);
        expect(res.status).toBe(200);
        for (const item of res.body.items) seen.add(item.id);
        cursor = res.body.nextCursor;
        pages++;
        if (pages > 10) throw new Error('infinite loop guard');
      } while (cursor);
      expect(seen.size).toBe(5);
      // 5개를 limit 2 로 → 3 페이지 (2 + 2 + 1).
      expect(pages).toBe(3);
    });

    it('limit 기본 20 — 21개 넣으면 첫 페이지 20 + nextCursor 존재', async () => {
      for (let i = 0; i < 21; i++) {
        // eslint-disable-next-line no-await-in-loop
        await createPost(app, 'alice', { title: `post-${i}` });
      }
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(20);
      expect(res.body.nextCursor).toBeTruthy();

      // 두 번째 페이지로 나머지 1개 확인.
      const res2 = await request(app).get(`/api/posts?cursor=${res.body.nextCursor}`);
      expect(res2.status).toBe(200);
      expect(res2.body.items).toHaveLength(1);
      expect(res2.body.nextCursor).toBeNull();
    });

    it('태그 필터 — tag=음식 으로 매칭만', async () => {
      await createPost(app, 'alice', { title: 'food', tags: ['음식'] });
      await createPost(app, 'alice', { title: 'sport', tags: ['스포츠'] });
      const res = await request(app).get('/api/posts?tag=음식');
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('food');
    });

    it('list 응답은 openChatUrl 항상 마스킹 (비owner / RECRUITING)', async () => {
      await createPost(app, 'alice');
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
      expect(res.body.items[0].openChatUrl).toBeUndefined();
    });

    it('list 응답은 openChatUrl 항상 마스킹 (owner + FULL — detail 분기와 무관)', async () => {
      const create = await createPost(app, 'alice');
      const { memDb } = await import('./setup.js');
      const row = memDb.posts.get(create.body.post.id);
      memDb.posts.set(create.body.post.id, { ...row, status: 'FULL' });

      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.items[0].status).toBe('FULL');
      // list 는 정책상 무조건 마스킹. owner 든 FULL 이든 detail 에서만 노출.
      expect(res.body.items[0].openChatUrl).toBeUndefined();
    });

    it('limit 100 → 400 (50 초과)', async () => {
      const res = await request(app).get('/api/posts?limit=100');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/posts/:id (detail)', () => {
    it('미존재 → 404', async () => {
      const res = await request(app).get('/api/posts/nonexistent');
      expect(res.status).toBe(404);
    });

    it('비owner 조회 → openChatUrl 마스킹 (RECRUITING 일 때)', async () => {
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      const token = tokenFor('bob');
      const res = await request(app)
        .get(`/api/posts/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.post.openChatUrl).toBeUndefined();
    });

    it('owner 조회 → openChatUrl 노출', async () => {
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      const token = tokenFor('alice');
      const res = await request(app)
        .get(`/api/posts/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.post.openChatUrl).toBe('https://open.kakao.com/o/test');
    });

    it('비로그인 조회 → 200, openChatUrl 마스킹', async () => {
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      const res = await request(app).get(`/api/posts/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.post.openChatUrl).toBeUndefined();
    });

    it('status=FULL 게시글 → 비신청 외부인은 여전히 마스킹 (#36 강화)', async () => {
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      // 라우터 분기만 검증하기 위해 fake DB 의 status 를 직접 FULL 로 변경.
      // (정상 흐름 — 신청자가 봤을 때 노출되는 케이스는 privacy.test.js 에서 다룸)
      const { memDb } = await import('./setup.js');
      const row = memDb.posts.get(id);
      memDb.posts.set(id, { ...row, status: 'FULL' });

      const token = tokenFor('bob'); // bob 은 신청 안 한 외부인
      const res = await request(app)
        .get(`/api/posts/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.post.status).toBe('FULL');
      // #36: 비신청자는 FULL 이어도 노출 X.
      expect(res.body.post.openChatUrl).toBeUndefined();
    });
  });

  describe('DELETE /api/posts/:id', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).delete('/api/posts/anything');
      expect(res.status).toBe(401);
    });

    it('타인 게시글 삭제 → 403', async () => {
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      const token = tokenFor('bob');
      const res = await request(app)
        .delete(`/api/posts/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('본인 게시글 삭제 → 204 + 후속 GET 404', async () => {
      const create = await createPost(app, 'alice');
      const id = create.body.post.id;
      const token = tokenFor('alice');
      const del = await request(app)
        .delete(`/api/posts/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(204);

      const after = await request(app).get(`/api/posts/${id}`);
      expect(after.status).toBe(404);
    });

    it('미존재 게시글 삭제 → 404', async () => {
      const token = tokenFor('alice');
      const res = await request(app)
        .delete(`/api/posts/nonexistent`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/health', () => {
    it('200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true, service: 'hobby-api' });
    });
  });
});
