/**
 * board-api 카드 수정/삭제 통합 테스트 (#48).
 *
 * 커버리지:
 *  - PATCH  /api/cards/:id           : title/description/assigneeId 수정 + assignee 검증
 *  - DELETE /api/cards/:id           : 삭제 + 권한
 *
 * 생성/조회는 `cards.create.test.js`, 이동은 `cards.move.test.js` 가 담당 (파일 300줄 룰).
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { columnsOf, createCard } from './cards-helpers.js';
import { authHeader, createProject, inviteMember } from './helpers.js';
import { memDb } from './setup.js';

describe('board-api cards modify', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 10_000 });
  });

  describe('PATCH /api/cards/:id', () => {
    // #455: expectedUpdatedAt 은 이제 필수. 기존 케이스에 expected 헬퍼로 채워보낸다.
    const expected = (card) => new Date(card.updatedAt).toISOString();

    it('title 변경 → 200', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id, { title: 'old' });
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('alice'))
        .send({ title: 'new', expectedUpdatedAt: expected(card) });
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
        .send({ description: null, expectedUpdatedAt: expected(card) });
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
        .send({ assigneeId: 'bob', expectedUpdatedAt: expected(card) });
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
        .send({ assigneeId: 'eve', expectedUpdatedAt: expected(card) });
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
        .send({ assigneeId: null, expectedUpdatedAt: expected(card) });
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
        .send({ title: 'x', expectedUpdatedAt: expected(card) });
      expect(res.status).toBe(403);
    });

    it('존재하지 않는 카드 → 404', async () => {
      const res = await request(app)
        .patch('/api/cards/card_nope')
        .set(authHeader('alice'))
        .send({ title: 'x', expectedUpdatedAt: new Date().toISOString() });
      expect(res.status).toBe(404);
    });

    // #455: expectedUpdatedAt 미전송 → 400 + 최신 카드 포함.
    it('expectedUpdatedAt 미전송 → 400 MissingExpectedUpdatedAt', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('alice'))
        .send({ title: 'new' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MissingExpectedUpdatedAt');
      expect(res.body.card?.id).toBe(card.id);
    });

    // #253 conflict detection
    it('expectedUpdatedAt 일치 → 200', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app)
        .patch(`/api/cards/${card.id}`)
        .set(authHeader('alice'))
        .send({
          title: 'new',
          expectedUpdatedAt: new Date(card.updatedAt).toISOString(),
        });
      expect(res.status).toBe(200);
      expect(res.body.card.title).toBe('new');
    });

    it('expectedUpdatedAt 불일치 → 409 Conflict', async () => {
      const pid = await createProject(request, app, 'alice');
      const [todo] = columnsOf(pid);
      const card = await createCard(app, 'alice', todo.id);
      const res = await request(app).patch(`/api/cards/${card.id}`).set(authHeader('alice')).send({
        title: 'new',
        // 임의의 옛 시점 — 충돌 시뮬레이션
        expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
      // 서버는 현재 row 를 함께 돌려준다 (FE 새로고침 없이도 최신 값 보여줄 수 있게)
      expect(res.body.card).toBeDefined();
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
});
