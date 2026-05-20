/**
 * board-api 컬럼 CRUD 통합 테스트.
 *
 * 커버리지 (#47):
 *  - POST   /api/projects/:id/columns          : 생성 + order 자동 배치 / 명시 order / 비멤버 403
 *  - GET    /api/projects/:id/columns          : 멤버만, order 정렬
 *  - PATCH  /api/projects/:id/columns/:colId   : 이름/순서 변경, 비멤버 403, 다른 프로젝트 컬럼 404
 *  - DELETE /api/projects/:id/columns/:colId   : 마지막 컬럼 삭제 가드, 비멤버 403, cascade
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { authHeader, createProject, inviteMember } from './helpers.js';
import { memDb } from './setup.js';

/**
 * 프로젝트 생성 직후 자동 생성된 기본 컬럼 3개의 id를 order asc 로 돌려준다.
 *
 * @param {string} projectId
 * @returns {{ id: string, name: string, order: number }[]}
 */
const defaultColumnsOf = (projectId) =>
  [...memDb.boardColumns.values()]
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.order - b.order);

describe('board-api columns', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('POST /api/projects/:id/columns', () => {
    it('멤버가 컬럼 생성 → 201 + 마지막 order + 1000', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .post(`/api/projects/${id}/columns`)
        .set(authHeader('alice'))
        .send({ name: 'Review' });
      expect(res.status).toBe(201);
      expect(res.body.column).toMatchObject({ name: 'Review', projectId: id });
      // 기본 컬럼 3개의 max order(3000) + 1000 = 4000
      expect(res.body.column.order).toBe(4000);
    });

    it('order 명시 시 그 값으로 저장', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .post(`/api/projects/${id}/columns`)
        .set(authHeader('alice'))
        .send({ name: 'Mid', order: 1500 });
      expect(res.status).toBe(201);
      expect(res.body.column.order).toBe(1500);
    });

    it('비멤버 → 403', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .post(`/api/projects/${id}/columns`)
        .set(authHeader('eve'))
        .send({ name: 'X' });
      expect(res.status).toBe(403);
    });

    it('인증 없으면 401', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app).post(`/api/projects/${id}/columns`).send({ name: 'X' });
      expect(res.status).toBe(401);
    });

    it('name 누락 → 400', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .post(`/api/projects/${id}/columns`)
        .set(authHeader('alice'))
        .send({});
      expect(res.status).toBe(400);
    });

    it('name 공백 → 400', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .post(`/api/projects/${id}/columns`)
        .set(authHeader('alice'))
        .send({ name: '   ' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects/:id/columns', () => {
    it('멤버는 200 + order asc 정렬', async () => {
      const id = await createProject(request, app, 'alice');
      // 기본 컬럼 사이에 새 컬럼 끼워넣기
      await request(app)
        .post(`/api/projects/${id}/columns`)
        .set(authHeader('alice'))
        .send({ name: 'Mid', order: 1500 });

      const res = await request(app).get(`/api/projects/${id}/columns`).set(authHeader('alice'));
      expect(res.status).toBe(200);
      const names = res.body.columns.map((c) => c.name);
      expect(names).toEqual(['Todo', 'Mid', 'Doing', 'Done']);
    });

    it('비멤버 → 403', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app).get(`/api/projects/${id}/columns`).set(authHeader('eve'));
      expect(res.status).toBe(403);
    });

    it('초대된 멤버도 조회 가능', async () => {
      const id = await createProject(request, app, 'alice');
      await inviteMember(request, app, id, 'alice', 'bob');
      const res = await request(app).get(`/api/projects/${id}/columns`).set(authHeader('bob'));
      expect(res.status).toBe(200);
      expect(res.body.columns).toHaveLength(3);
    });
  });

  describe('PATCH /api/projects/:id/columns/:colId', () => {
    it('이름 변경 → 200', async () => {
      const id = await createProject(request, app, 'alice');
      const cols = defaultColumnsOf(id);
      const target = cols[0]; // Todo
      const res = await request(app)
        .patch(`/api/projects/${id}/columns/${target.id}`)
        .set(authHeader('alice'))
        .send({ name: 'Backlog' });
      expect(res.status).toBe(200);
      expect(res.body.column.name).toBe('Backlog');
    });

    it('order 변경 → 200 + 재조회 시 정렬 반영', async () => {
      const id = await createProject(request, app, 'alice');
      const cols = defaultColumnsOf(id);
      const todo = cols[0]; // order 1000
      // Todo 를 Done 뒤로 (order = 3500) — between-keys
      const res = await request(app)
        .patch(`/api/projects/${id}/columns/${todo.id}`)
        .set(authHeader('alice'))
        .send({ order: 3500 });
      expect(res.status).toBe(200);
      expect(res.body.column.order).toBe(3500);

      const list = await request(app).get(`/api/projects/${id}/columns`).set(authHeader('alice'));
      expect(list.body.columns.map((c) => c.name)).toEqual(['Doing', 'Done', 'Todo']);
    });

    it('빈 body → 400', async () => {
      const id = await createProject(request, app, 'alice');
      const [todo] = defaultColumnsOf(id);
      const res = await request(app)
        .patch(`/api/projects/${id}/columns/${todo.id}`)
        .set(authHeader('alice'))
        .send({});
      expect(res.status).toBe(400);
    });

    it('비멤버 → 403', async () => {
      const id = await createProject(request, app, 'alice');
      const [todo] = defaultColumnsOf(id);
      const res = await request(app)
        .patch(`/api/projects/${id}/columns/${todo.id}`)
        .set(authHeader('eve'))
        .send({ name: 'X' });
      expect(res.status).toBe(403);
    });

    it('다른 프로젝트 컬럼 ID로 수정 시도 → 404', async () => {
      const pA = await createProject(request, app, 'alice', { name: 'A' });
      const pB = await createProject(request, app, 'alice', { name: 'B' });
      const [bTodo] = defaultColumnsOf(pB);
      const res = await request(app)
        .patch(`/api/projects/${pA}/columns/${bTodo.id}`)
        .set(authHeader('alice'))
        .send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    it('존재하지 않는 컬럼 → 404', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .patch(`/api/projects/${id}/columns/col_nope`)
        .set(authHeader('alice'))
        .send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id/columns/:colId', () => {
    it('컬럼 삭제 → 204', async () => {
      const id = await createProject(request, app, 'alice');
      const cols = defaultColumnsOf(id);
      const res = await request(app)
        .delete(`/api/projects/${id}/columns/${cols[2].id}`)
        .set(authHeader('alice'));
      expect(res.status).toBe(204);
      expect(defaultColumnsOf(id)).toHaveLength(2);
    });

    it('마지막 컬럼 삭제 시도 → 409 (LastColumn 가드)', async () => {
      const id = await createProject(request, app, 'alice');
      const cols = defaultColumnsOf(id);
      // 3개 중 2개를 먼저 지운 뒤 마지막 1개 삭제 시도
      for (const c of cols.slice(0, 2)) {
        const r = await request(app)
          .delete(`/api/projects/${id}/columns/${c.id}`)
          .set(authHeader('alice'));
        expect(r.status).toBe(204);
      }
      const remaining = defaultColumnsOf(id);
      expect(remaining).toHaveLength(1);

      const res = await request(app)
        .delete(`/api/projects/${id}/columns/${remaining[0].id}`)
        .set(authHeader('alice'));
      expect(res.status).toBe(409);
      expect(defaultColumnsOf(id)).toHaveLength(1);
    });

    it('비멤버 → 403', async () => {
      const id = await createProject(request, app, 'alice');
      const [todo] = defaultColumnsOf(id);
      const res = await request(app)
        .delete(`/api/projects/${id}/columns/${todo.id}`)
        .set(authHeader('eve'));
      expect(res.status).toBe(403);
    });

    it('다른 프로젝트 컬럼 ID로 삭제 시도 → 404', async () => {
      const pA = await createProject(request, app, 'alice', { name: 'A' });
      const pB = await createProject(request, app, 'alice', { name: 'B' });
      const [bTodo] = defaultColumnsOf(pB);
      const res = await request(app)
        .delete(`/api/projects/${pA}/columns/${bTodo.id}`)
        .set(authHeader('alice'));
      expect(res.status).toBe(404);
      // pB의 컬럼은 그대로
      expect(defaultColumnsOf(pB)).toHaveLength(3);
    });

    it('존재하지 않는 컬럼 → 404', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .delete(`/api/projects/${id}/columns/col_nope`)
        .set(authHeader('alice'));
      expect(res.status).toBe(404);
    });
  });
});
