/**
 * board-api 프로젝트 CRUD 통합 테스트.
 *
 * 커버리지:
 *  - POST   /api/projects              : 생성 + OWNER 멤버 + Todo/Doing/Done 자동 컬럼
 *  - GET    /api/projects              : 본인 멤버인 프로젝트만 노출
 *  - GET    /api/projects/:id          : 본인 멤버 → 200, 외부인 → 403
 *  - PATCH  /api/projects/:id          : MEMBER 가능, 외부인 → 403
 *  - DELETE /api/projects/:id          : OWNER만 가능, MEMBER → 403
 *  - GET    /api/health
 *
 * Members(초대/탈퇴)는 `members.test.js` 참고.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { authHeader, inviteMember } from './helpers.js';
import { memDb } from './setup.js';

describe('board-api projects', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('POST /api/projects', () => {
    it('인증 없으면 401', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'P' });
      expect(res.status).toBe(401);
    });

    it('정상 생성 → 201 + 생성자가 OWNER 멤버 + 기본 컬럼 3개', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: '내 첫 프로젝트', description: '데모' });
      expect(res.status).toBe(201);
      expect(res.body.project).toMatchObject({ name: '내 첫 프로젝트', ownerId: 'alice' });
      const projectId = res.body.project.id;

      const members = [...memDb.projectMembers.values()].filter((m) => m.projectId === projectId);
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({ userId: 'alice', role: 'OWNER' });

      const cols = [...memDb.boardColumns.values()]
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => a.order - b.order);
      expect(cols).toHaveLength(3);
      expect(cols.map((c) => c.name)).toEqual(['Todo', 'Doing', 'Done']);
      expect(cols.map((c) => c.order)).toEqual([1000, 2000, 3000]);
    });

    it('name 누락 → 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ description: '' });
      expect(res.status).toBe(400);
    });

    it('name 빈 문자열(공백) → 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: '   ' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/projects', () => {
    it('본인 멤버인 프로젝트만 노출', async () => {
      const p1 = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: 'A1' });
      await request(app).post('/api/projects').set(authHeader('bob')).send({ name: 'B1' });

      const res = await request(app).get('/api/projects').set(authHeader('alice'));
      expect(res.status).toBe(200);
      expect(res.body.projects).toHaveLength(1);
      expect(res.body.projects[0].id).toBe(p1.body.project.id);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('외부인은 403', async () => {
      const p = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: 'A1' });
      const res = await request(app)
        .get(`/api/projects/${p.body.project.id}`)
        .set(authHeader('eve'));
      expect(res.status).toBe(403);
    });

    it('멤버는 200', async () => {
      const p = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: 'A1' });
      const res = await request(app)
        .get(`/api/projects/${p.body.project.id}`)
        .set(authHeader('alice'));
      expect(res.status).toBe(200);
      expect(res.body.project.id).toBe(p.body.project.id);
    });

    it('존재하지 않는 ID → 404', async () => {
      const res = await request(app).get('/api/projects/nope').set(authHeader('alice'));
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('OWNER가 이름 변경 → 200', async () => {
      const p = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: 'A1' });
      const res = await request(app)
        .patch(`/api/projects/${p.body.project.id}`)
        .set(authHeader('alice'))
        .send({ name: 'A2' });
      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe('A2');
    });

    it('외부인 → 403', async () => {
      const p = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: 'A1' });
      const res = await request(app)
        .patch(`/api/projects/${p.body.project.id}`)
        .set(authHeader('eve'))
        .send({ name: 'X' });
      expect(res.status).toBe(403);
    });

    it('빈 body → 400', async () => {
      const p = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: 'A1' });
      const res = await request(app)
        .patch(`/api/projects/${p.body.project.id}`)
        .set(authHeader('alice'))
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('OWNER만 삭제 가능 (cascade 검증 포함)', async () => {
      const p = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: 'A1' });
      expect(p.status).toBe(201);
      const id = p.body.project.id;

      await inviteMember(request, app, id, 'alice', 'bob');

      const bobRes = await request(app).delete(`/api/projects/${id}`).set(authHeader('bob'));
      expect(bobRes.status).toBe(403);

      const aliceRes = await request(app).delete(`/api/projects/${id}`).set(authHeader('alice'));
      expect(aliceRes.status).toBe(204);

      const members = [...memDb.projectMembers.values()].filter((m) => m.projectId === id);
      const cols = [...memDb.boardColumns.values()].filter((c) => c.projectId === id);
      expect(members).toHaveLength(0);
      expect(cols).toHaveLength(0);
    });

    it('외부인 → 403', async () => {
      const p = await request(app)
        .post('/api/projects')
        .set(authHeader('alice'))
        .send({ name: 'A1' });
      const res = await request(app)
        .delete(`/api/projects/${p.body.project.id}`)
        .set(authHeader('eve'));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/health', () => {
    it('200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
