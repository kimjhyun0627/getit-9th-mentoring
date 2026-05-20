/**
 * board-api 카드 생성/조회 통합 테스트 (#48).
 *
 * 커버리지:
 *  - POST   /api/cards               : 생성 + order 자동 / 명시 / assignee 검증 / 권한
 *  - GET    /api/cards?columnId=...  : 컬럼별 목록 (order asc) / 권한
 *  - GET    /api/cards/:id           : 단건 조회 + 권한
 *
 * 수정/삭제는 `cards.modify.test.js`, 이동은 `cards.move.test.js` 가 담당 (파일 300줄 룰).
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { columnsOf, createCard } from './cards-helpers.js';
import { authHeader, createProject, inviteMember } from './helpers.js';

describe('board-api cards create/read', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    // rate limiter 가 테스트간 누적 카운트로 false-positive 429 를 내지 않도록
    // 한도를 충분히 크게 잡아 둔다.
    app = createApp({ rateLimitMax: 10_000 });
  });

  describe('POST /api/cards', () => {
    it('멤버가 카드 생성 → 201 + order 자동 1000', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const res = await request(app)
        .post('/api/cards')
        .set(authHeader('alice'))
        .send({ columnId: todo.id, title: 'My task' });
      expect(res.status).toBe(201);
      expect(res.body.card).toMatchObject({
        columnId: todo.id,
        title: 'My task',
        order: 1000,
        assigneeId: null,
        description: null,
      });
    });

    it('두 번째 카드 → order = 마지막 + 1000', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      await createCard(app, 'alice', todo.id, { title: 'A' });
      const res = await request(app)
        .post('/api/cards')
        .set(authHeader('alice'))
        .send({ columnId: todo.id, title: 'B' });
      expect(res.status).toBe(201);
      expect(res.body.card.order).toBe(2000);
    });

    it('order 명시 시 그 값 그대로', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const res = await request(app)
        .post('/api/cards')
        .set(authHeader('alice'))
        .send({ columnId: todo.id, title: 'X', order: 250 });
      expect(res.status).toBe(201);
      expect(res.body.card.order).toBe(250);
    });

    it('프로젝트 멤버를 assignee 지정 → 201', async () => {
      const pid = await createProject(request, app, 'alice');
      await inviteMember(request, app, pid, 'alice', 'bob');
      const [todo] = columnsOf(pid);
      const res = await request(app)
        .post('/api/cards')
        .set(authHeader('alice'))
        .send({ columnId: todo.id, title: 'T', assigneeId: 'bob' });
      expect(res.status).toBe(201);
      expect(res.body.card.assigneeId).toBe('bob');
    });

    it('비멤버를 assignee 지정 → 422', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const res = await request(app)
        .post('/api/cards')
        .set(authHeader('alice'))
        .send({ columnId: todo.id, title: 'T', assigneeId: 'eve' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('AssigneeNotMember');
    });

    it('비프로젝트 멤버 → 403', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const res = await request(app)
        .post('/api/cards')
        .set(authHeader('eve'))
        .send({ columnId: todo.id, title: 'T' });
      expect(res.status).toBe(403);
    });

    it('인증 없으면 401', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const res = await request(app).post('/api/cards').send({ columnId: todo.id, title: 'T' });
      expect(res.status).toBe(401);
    });

    it('존재하지 않는 columnId → 404', async () => {
      await createProject(request, app, 'alice');
      const res = await request(app)
        .post('/api/cards')
        .set(authHeader('alice'))
        .send({ columnId: 'col_nope', title: 'T' });
      expect(res.status).toBe(404);
    });

    it('title 누락 → 400', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const res = await request(app)
        .post('/api/cards')
        .set(authHeader('alice'))
        .send({ columnId: todo.id });
      expect(res.status).toBe(400);
    });

    it('columnId 누락 → 400 (Zod 검증)', async () => {
      await createProject(request, app, 'alice');
      const res = await request(app)
        .post('/api/cards')
        .set(authHeader('alice'))
        .send({ title: 'T' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/cards', () => {
    it('?columnId 로 컬럼 카드 목록 (order asc)', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      await createCard(app, 'alice', todo.id, { title: 'A', order: 2000 });
      await createCard(app, 'alice', todo.id, { title: 'B', order: 1000 });
      const res = await request(app).get(`/api/cards?columnId=${todo.id}`).set(authHeader('alice'));
      expect(res.status).toBe(200);
      expect(res.body.cards.map((c) => c.title)).toEqual(['B', 'A']);
    });

    it('비멤버 → 403', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const res = await request(app).get(`/api/cards?columnId=${todo.id}`).set(authHeader('eve'));
      expect(res.status).toBe(403);
    });

    it('columnId 누락 → 400', async () => {
      await createProject(request, app, 'alice');
      const res = await request(app).get('/api/cards').set(authHeader('alice'));
      expect(res.status).toBe(400);
    });

    it('존재하지 않는 columnId → 404', async () => {
      const res = await request(app).get('/api/cards?columnId=col_nope').set(authHeader('alice'));
      expect(res.status).toBe(404);
    });

    // #258: batch endpoint — 컬럼당 1 query 회피.
    it('?projectId 로 모든 컬럼 카드 batch (cardsByColumn)', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo, doing, done] = columnsOf(pid);
      await createCard(app, 'alice', todo.id, { title: 'T1' });
      await createCard(app, 'alice', todo.id, { title: 'T2' });
      await createCard(app, 'alice', doing.id, { title: 'D1' });
      // done 비어있어도 키는 존재해야 한다.
      const res = await request(app).get(`/api/cards?projectId=${pid}`).set(authHeader('alice'));
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.cardsByColumn).sort()).toEqual(
        [todo.id, doing.id, done.id].sort(),
      );
      expect(res.body.cardsByColumn[todo.id].map((c) => c.title)).toEqual(['T1', 'T2']);
      expect(res.body.cardsByColumn[doing.id].map((c) => c.title)).toEqual(['D1']);
      expect(res.body.cardsByColumn[done.id]).toEqual([]);
    });

    it('?projectId batch 비멤버 → 403', async () => {
      const pid = await createProject(request, app, 'alice');
      const res = await request(app).get(`/api/cards?projectId=${pid}`).set(authHeader('eve'));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/cards/:id', () => {
    it('단건 조회 → 200', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id, { title: 'X' });
      const res = await request(app).get(`/api/cards/${card.id}`).set(authHeader('alice'));
      expect(res.status).toBe(200);
      expect(res.body.card.id).toBe(card.id);
    });

    it('비멤버 → 403', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app).get(`/api/cards/${card.id}`).set(authHeader('eve'));
      expect(res.status).toBe(403);
    });

    it('존재하지 않는 카드 → 404', async () => {
      const res = await request(app).get('/api/cards/card_nope').set(authHeader('alice'));
      expect(res.status).toBe(404);
    });
  });
});
