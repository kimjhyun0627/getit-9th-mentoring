/**
 * GET /api/projects/:id/members — 카드 담당자 picker 용 멤버 목록 (#200).
 *
 *  - 멤버: 200, 본인 + 다른 멤버 전체 노출
 *  - 외부인: 403 (requireProjectMember)
 *  - 응답 shape: { members: [{ userId, role, name, joinedAt }] }
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { authHeader, createProject, inviteMember } from './helpers.js';

describe('GET /api/projects/:id/members', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp();
  });

  it('멤버는 200 + 멤버 목록 반환', async () => {
    const pid = await createProject(request, app, 'alice');
    await inviteMember(request, app, pid, 'alice', 'bob');

    const res = await request(app).get(`/api/projects/${pid}/members`).set(authHeader('alice'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.members)).toBe(true);
    expect(res.body.members).toHaveLength(2);
    const map = Object.fromEntries(res.body.members.map((m) => [m.userId, m]));
    expect(map.alice).toMatchObject({ userId: 'alice', role: 'OWNER' });
    expect(map.bob).toMatchObject({ userId: 'bob', role: 'MEMBER' });
    res.body.members.forEach((m) => {
      expect(m).toHaveProperty('name');
    });
  });

  it('외부인 → 403', async () => {
    const pid = await createProject(request, app, 'alice');
    const res = await request(app).get(`/api/projects/${pid}/members`).set(authHeader('eve'));
    expect(res.status).toBe(403);
  });

  it('인증 없으면 401', async () => {
    const pid = await createProject(request, app, 'alice');
    const res = await request(app).get(`/api/projects/${pid}/members`);
    expect(res.status).toBe(401);
  });
});
