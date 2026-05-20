/**
 * board-api 카드 이동 (between-keys) 통합 테스트 (#48).
 *
 * 커버리지: `PATCH /api/cards/:id/move`
 *  - 같은 컬럼 내 between-keys `(prev.order + next.order) / 2` (평균)
 *  - 다른 컬럼 이동 → columnId 갱신 + order 적용
 *  - order 미입력 + 빈 컬럼 → 끝 (lastOrder + 1000)
 *  - 자기 자신이 같은 컬럼 끝일 때 order 미입력 no-op → order 유지 (회귀 가드)
 *  - 다른 프로젝트 컬럼 / 비멤버 / 400 / 404
 *
 * CRUD 케이스는 `cards.crud.test.js` 가 담당 (파일 300줄 룰).
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { columnsOf, createCard } from './cards-helpers.js';
import { authHeader, createProject } from './helpers.js';

describe('board-api cards move', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 10_000 });
  });

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

    const list = await request(app).get(`/api/cards?columnId=${todo.id}`).set(authHeader('alice'));
    expect(list.body.cards.map((x) => x.title)).toEqual(['A', 'C', 'B']);
    // a, b 의 order 는 변하지 않음
    expect(list.body.cards[0].order).toBe(1000);
    expect(list.body.cards[2].order).toBe(2000);
    // between-keys 평균 검증
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

    const list = await request(app).get(`/api/cards?columnId=${doing.id}`).set(authHeader('alice'));
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

  it('자기 자신이 같은 컬럼 끝 + order 미입력 → order 유지 (no-op 회귀 가드)', async () => {
    const pid = await createProject(request, app, 'alice');
    const [todo] = columnsOf(pid);
    const card = await createCard(app, 'alice', todo.id, { title: 'X', order: 1000 });
    // 같은 컬럼으로 order 없이 호출 — last 가 자기 자신이라 order 유지돼야 함.
    // (예전 ternary 버그: 항상 +ORDER_GAP 해 order 가 무한정 증가했음)
    const r1 = await request(app)
      .patch(`/api/cards/${card.id}/move`)
      .set(authHeader('alice'))
      .send({ columnId: todo.id });
    expect(r1.status).toBe(200);
    expect(r1.body.card.order).toBe(1000);

    // 두 번 더 호출해도 동일 — order drift 없음
    const r2 = await request(app)
      .patch(`/api/cards/${card.id}/move`)
      .set(authHeader('alice'))
      .send({ columnId: todo.id });
    expect(r2.body.card.order).toBe(1000);
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
