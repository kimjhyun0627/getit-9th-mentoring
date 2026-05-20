/**
 * board-api 카드 CRUD + 이동 통합 테스트 (#48).
 *
 * 커버리지:
 *  - POST   /api/cards                  : 컬럼에 카드 생성 + order 자동 / 명시 / assignee 검증
 *  - GET    /api/cards?columnId=...     : 컬럼별 카드 목록 (order asc)
 *  - GET    /api/cards/:id              : 단건 조회 + 권한
 *  - PATCH  /api/cards/:id              : title/description/assigneeId 수정 + assignee 검증
 *  - DELETE /api/cards/:id              : 삭제
 *  - PATCH  /api/cards/:id/move         : 컬럼 간 / 같은 컬럼 내 between-keys 이동
 *
 * 권한: 모든 엔드포인트는 카드(또는 컬럼) 소속 프로젝트의 멤버만 허용 (403/404).
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { authHeader, createProject, inviteMember } from './helpers.js';
import { memDb } from './setup.js';

/**
 * 프로젝트의 컬럼들을 order asc 로 반환.
 *
 * @param {string} projectId
 */
const columnsOf = (projectId) =>
  [...memDb.boardColumns.values()]
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.order - b.order);

/**
 * 카드 생성 헬퍼.
 *
 * @param {import('express').Express} app
 * @param {string} userSub
 * @param {string} columnId
 * @param {Record<string, unknown>} [body]
 */
const createCard = async (app, userSub, columnId, body = {}) => {
  const res = await request(app)
    .post('/api/cards')
    .set(authHeader(userSub))
    .send({ columnId, title: 'T', ...body });
  if (res.status !== 201) {
    throw new Error(
      `createCard setup failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }
  return res.body.card;
};

describe('board-api cards', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    // rate limiter 가 테스트간 누적 카운트로 false-positive 429 를 내지 않도록
    // 한도를 충분히 크게 잡아 둔다. (#48 회귀: 카드+컬럼+프로젝트 호출 합산이 60 초과)
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

    it('columnId 누락 → 400', async () => {
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

  describe('PATCH /api/cards/:id', () => {
    it('title 변경 → 200', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id, { title: 'old' });
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('alice'))
        .send({ title: 'new' });
      expect(res.status).toBe(200);
      expect(res.body.card.title).toBe('new');
    });

    it('description null 로 클리어 → 200', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id, { description: 'hi' });
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('alice'))
        .send({ description: null });
      expect(res.status).toBe(200);
      expect(res.body.card.description).toBeNull();
    });

    it('프로젝트 멤버 assignee 변경 → 200', async () => {
      const pid = await createProject(request, app, 'alice');
      await inviteMember(request, app, pid, 'alice', 'bob');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('alice'))
        .send({ assigneeId: 'bob' });
      expect(res.status).toBe(200);
      expect(res.body.card.assigneeId).toBe('bob');
    });

    it('비멤버 assignee → 422', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('alice'))
        .send({ assigneeId: 'eve' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('AssigneeNotMember');
    });

    it('assigneeId null 로 해제 → 200', async () => {
      const pid = await createProject(request, app, 'alice');
      await inviteMember(request, app, pid, 'alice', 'bob');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id, { assigneeId: 'bob' });
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('alice'))
        .send({ assigneeId: null });
      expect(res.status).toBe(200);
      expect(res.body.card.assigneeId).toBeNull();
    });

    it('빈 body → 400', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('alice'))
        .send({});
      expect(res.status).toBe(400);
    });

    it('비멤버 → 403', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('eve'))
        .send({ title: 'x' });
      expect(res.status).toBe(403);
    });

    it('존재하지 않는 카드 → 404', async () => {
      const res = await request(app)
        .patch('/api/cards/card_nope')
        .set(authHeader('alice'))
        .send({ title: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/cards/:id', () => {
    it('삭제 → 204', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app).delete(`/api/cards/${card.id}`).set(authHeader('alice'));
      expect(res.status).toBe(204);
      expect(memDb.cards.has(card.id)).toBe(false);
    });

    it('비멤버 → 403', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app).delete(`/api/cards/${card.id}`).set(authHeader('eve'));
      expect(res.status).toBe(403);
    });

    it('존재하지 않는 카드 → 404', async () => {
      const res = await request(app).delete('/api/cards/card_nope').set(authHeader('alice'));
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/cards/:id/move', () => {
    it('같은 컬럼 내에서 두 카드 사이로 이동 → between-keys (평균)', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const a = await createCard(app, 'alice', todo.id, { title: 'A', order: 1000 });
      const b = await createCard(app, 'alice', todo.id, { title: 'B', order: 2000 });
      const c = await createCard(app, 'alice', todo.id, { title: 'C', order: 3000 });

      // C 를 A 와 B 사이로 — order = 1500
      const res = await request(app)
        .patch(`/api/cards/${c.id}/move`)
        .set(authHeader('alice'))
        .send({ columnId: todo.id, order: 1500 });
      expect(res.status).toBe(200);
      expect(res.body.card.order).toBe(1500);

      const list = await request(app)
        .get(`/api/cards?columnId=${todo.id}`)
        .set(authHeader('alice'));
      expect(list.body.cards.map((x) => x.title)).toEqual(['A', 'C', 'B']);
      // a, b 의 order 는 변하지 않았음을 보장
      expect(list.body.cards[0].order).toBe(1000);
      expect(list.body.cards[2].order).toBe(2000);
      // 헬퍼에서 만든 a/b 값과 비교 — between-keys 의 평균값이어야 한다
      expect(res.body.card.order).toBe((a.order + b.order) / 2);
    });

    it('다른 컬럼으로 이동 → columnId 갱신 + order 적용', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo, doing] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id, { title: 'X', order: 1000 });
      const res = await request(app)
        .patch(`/api/cards/${card.id}/move`)
        .set(authHeader('alice'))
        .send({ columnId: doing.id, order: 500 });
      expect(res.status).toBe(200);
      expect(res.body.card.columnId).toBe(doing.id);
      expect(res.body.card.order).toBe(500);

      const list = await request(app)
        .get(`/api/cards?columnId=${doing.id}`)
        .set(authHeader('alice'));
      expect(list.body.cards.map((c) => c.id)).toContain(card.id);
    });

    it('order 미입력 + 빈 컬럼으로 이동 → 끝(lastOrder + 1000)', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo, doing] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id, { title: 'X', order: 1000 });
      // 첫 이동 — doing 비어있음
      const res1 = await request(app)
        .patch(`/api/cards/${card.id}/move`)
        .set(authHeader('alice'))
        .send({ columnId: doing.id });
      expect(res1.status).toBe(200);
      expect(res1.body.card.order).toBe(1000);

      // 두 번째 카드 만들고 doing 끝으로
      const second = await createCard(app, 'alice', todo.id, { title: 'Y' });
      const res2 = await request(app)
        .patch(`/api/cards/${second.id}/move`)
        .set(authHeader('alice'))
        .send({ columnId: doing.id });
      expect(res2.status).toBe(200);
      expect(res2.body.card.order).toBe(2000);
    });

    it('다른 프로젝트 컬럼으로 이동 → 404', async () => {
      const pA = await createProject(request, app, 'alice', { name: 'A' });
      const pB = await createProject(request, app, 'alice', { name: 'B' });
      const [todoA] = columnsOf(pA);
      const [todoB] = columnsOf(pB);
      const card = await createCard(app, 'alice', todoA.id);
      const res = await request(app)
        .patch(`/api/cards/${card.id}/move`)
        .set(authHeader('alice'))
        .send({ columnId: todoB.id });
      expect(res.status).toBe(404);
    });

    it('비멤버 → 403', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo, doing] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app)
        .patch(`/api/cards/${card.id}/move`)
        .set(authHeader('eve'))
        .send({ columnId: doing.id });
      expect(res.status).toBe(403);
    });

    it('columnId 누락 → 400', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app)
        .patch(`/api/cards/${card.id}/move`)
        .set(authHeader('alice'))
        .send({});
      expect(res.status).toBe(400);
    });

    it('존재하지 않는 카드 → 404', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const res = await request(app)
        .patch('/api/cards/card_nope/move')
        .set(authHeader('alice'))
        .send({ columnId: todo.id });
      expect(res.status).toBe(404);
    });
  });
});
