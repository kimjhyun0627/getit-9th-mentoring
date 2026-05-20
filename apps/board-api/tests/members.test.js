/**
 * board-api 멤버 초대/탈퇴 통합 테스트.
 *
 * - POST   /api/projects/:id/members              : OWNER만 가능, 중복 → 409, 외부인 → 403
 * - DELETE /api/projects/:id/members/:userId      : 본인 탈퇴 OK / OWNER가 추방 / OWNER 본인탈퇴 400
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { authHeader, createProject } from './helpers.js';

describe('board-api members', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('POST /api/projects/:id/members', () => {
    it('OWNER가 새 멤버 초대 → 201', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('alice'))
        .send({ userId: 'bob' });
      expect(res.status).toBe(201);
      expect(res.body.member).toMatchObject({ userId: 'bob', role: 'MEMBER' });
    });

    it('OWNER 아닌 멤버가 초대 시도 → 403', async () => {
      const id = await createProject(request, app, 'alice');
      await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('alice'))
        .send({ userId: 'bob' });
      const res = await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('bob'))
        .send({ userId: 'carol' });
      expect(res.status).toBe(403);
    });

    it('외부인이 초대 시도 → 403', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('eve'))
        .send({ userId: 'bob' });
      expect(res.status).toBe(403);
    });

    it('이미 멤버인 사용자 다시 초대 → 409', async () => {
      const id = await createProject(request, app, 'alice');
      await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('alice'))
        .send({ userId: 'bob' });
      const res = await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('alice'))
        .send({ userId: 'bob' });
      expect(res.status).toBe(409);
    });

    it('userId 누락 → 400', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('alice'))
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:id/members/:userId', () => {
    it('본인 탈퇴 OK (MEMBER)', async () => {
      const id = await createProject(request, app, 'alice');
      await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('alice'))
        .send({ userId: 'bob' });

      const res = await request(app)
        .delete(`/api/projects/${id}/members/bob`)
        .set(authHeader('bob'));
      expect(res.status).toBe(204);
    });

    it('OWNER가 본인 탈퇴 시도 → 400 (소유권 이전 먼저)', async () => {
      const id = await createProject(request, app, 'alice');
      const res = await request(app)
        .delete(`/api/projects/${id}/members/alice`)
        .set(authHeader('alice'));
      expect(res.status).toBe(400);
    });

    it('OWNER가 다른 멤버 추방 OK', async () => {
      const id = await createProject(request, app, 'alice');
      await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('alice'))
        .send({ userId: 'bob' });

      const res = await request(app)
        .delete(`/api/projects/${id}/members/bob`)
        .set(authHeader('alice'));
      expect(res.status).toBe(204);
    });

    it('MEMBER가 다른 사람 추방 시도 → 403', async () => {
      const id = await createProject(request, app, 'alice');
      await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('alice'))
        .send({ userId: 'bob' });
      await request(app)
        .post(`/api/projects/${id}/members`)
        .set(authHeader('alice'))
        .send({ userId: 'carol' });

      const res = await request(app)
        .delete(`/api/projects/${id}/members/carol`)
        .set(authHeader('bob'));
      expect(res.status).toBe(403);
    });
  });
});
