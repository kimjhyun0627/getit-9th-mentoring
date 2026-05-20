/**
 * board-api GET /projects + /projects/:id 응답 contract 테스트 (#297).
 *
 * FE 가 `p.role` (OWNER/MEMBER) + `p.members: [{userId, name}]` 을 기대하지만
 * 기존 BE 는 publicProject 가 그 필드를 빼고 응답했음 — 항상 "Member, 멤버 없음" 표시 버그.
 *
 * 본 contract:
 *  - GET /api/projects                : { projects: [{ ..., role, members }] }
 *  - GET /api/projects/:id            : { project:  { ..., role, members } }
 *  - role 은 현재 user 의 ProjectMember.role (없으면 절대 노출 안 됨 — DB 필터로 0개)
 *  - members 는 해당 프로젝트 전 멤버의 { userId, name } 배열. name 은 SSO 미연동이므로 null 허용.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { authHeader, createProject, inviteMember } from './helpers.js';

describe('board-api projects contract (#297)', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp();
  });

  it('GET /api/projects 응답에 role + members 가 포함된다', async () => {
    const pid = await createProject(request, app, 'alice');
    await inviteMember(request, app, pid, 'alice', 'bob');

    const res = await request(app).get('/api/projects').set(authHeader('alice'));
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    const p = res.body.projects[0];
    expect(p.role).toBe('OWNER');
    expect(p.currentUserId).toBe('alice');
    expect(Array.isArray(p.members)).toBe(true);
    const ids = p.members.map((m) => m.userId).sort();
    expect(ids).toEqual(['alice', 'bob']);
    p.members.forEach((m) => {
      expect(m).toHaveProperty('userId');
      expect(m).toHaveProperty('name');
    });
  });

  it('MEMBER 로 가입된 사용자의 role 은 MEMBER', async () => {
    const pid = await createProject(request, app, 'alice');
    await inviteMember(request, app, pid, 'alice', 'bob');

    const res = await request(app).get('/api/projects').set(authHeader('bob'));
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].role).toBe('MEMBER');
  });

  it('GET /api/projects/:id 응답에도 role + members 가 포함된다', async () => {
    const pid = await createProject(request, app, 'alice');
    await inviteMember(request, app, pid, 'alice', 'bob');

    const res = await request(app).get(`/api/projects/${pid}`).set(authHeader('alice'));
    expect(res.status).toBe(200);
    expect(res.body.project.role).toBe('OWNER');
    expect(res.body.project.currentUserId).toBe('alice');
    const ids = res.body.project.members.map((m) => m.userId).sort();
    expect(ids).toEqual(['alice', 'bob']);
  });
});
