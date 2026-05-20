/**
 * letter-api 메시지 CRUD 통합 테스트 (supertest).
 *
 * 커버리지 (Acceptance Criteria — issue #52):
 *  - POST /api/messages: 비인증 401 / 정상 201 / Zod 400
 *  - GET  /api/messages: is_mine 플래그 정확성 / authorId 미노출 / 최신순
 *  - DELETE /api/messages/:id: 본인 204 / 타인 403 / 비인증 401 / 미존재 404
 *  - PATCH  /api/messages/:id: 본인 200 / 타인 403 / 비인증 401 / 미존재 404
 *
 * 익명성 회귀 (응답 모양 강제) 의 더 강한 보호선은 #53 (BE-security) 에서
 * snapshot/contract test 로 별도 검증한다.
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

const SECRET = process.env.JWT_SECRET;

/** Bearer 토큰 헬퍼 */
const tokenFor = (sub, email = `${sub}@get-it.cloud`, name = sub) =>
  signJwt({ sub, email, name }, SECRET);

const validBody = (overrides = {}) => ({
  content: '안녕! 9기 화이팅',
  color: 'PINK',
  ...overrides,
});

const createMessage = (app, sub, overrides = {}) =>
  request(app)
    .post('/api/messages')
    .set('Authorization', `Bearer ${tokenFor(sub)}`)
    .send(validBody(overrides));

describe('letter-api messages', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  describe('POST /api/messages', () => {
    it('비인증 → 401', async () => {
      const res = await request(app).post('/api/messages').send(validBody());
      expect(res.status).toBe(401);
    });

    it('정상 → 201 + content/color 응답 + authorId 미노출', async () => {
      const res = await createMessage(app, 'alice');
      expect(res.status).toBe(201);
      expect(res.body.message).toMatchObject({
        content: '안녕! 9기 화이팅',
        color: 'PINK',
      });
      expect(res.body.message.id).toBeTruthy();
      // 익명성: 응답에 authorId / author 키 절대 X
      expect(res.body.message.authorId).toBeUndefined();
      expect(res.body.message.author).toBeUndefined();
      // 본인 작성이니 is_mine true
      expect(res.body.message.is_mine).toBe(true);
    });

    it('빈 content → 400', async () => {
      const token = tokenFor('alice');
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '   ', color: 'PINK' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('잘못된 color → 400', async () => {
      const token = tokenFor('alice');
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '안녕', color: 'RED' });
      expect(res.status).toBe(400);
    });

    it('content 501자 → 400', async () => {
      const token = tokenFor('alice');
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'a'.repeat(501), color: 'MINT' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/messages', () => {
    it('비인증 → 401 (is_mine 판단 위해 JWT 필수)', async () => {
      const res = await request(app).get('/api/messages');
      expect(res.status).toBe(401);
    });

    it('정상 → 200 + items[] + is_mine 정확성 + authorId 미노출', async () => {
      // alice 가 1개, bob 이 2개 작성
      await createMessage(app, 'alice', { content: 'alice msg', color: 'PINK' });
      await createMessage(app, 'bob', { content: 'bob msg 1', color: 'MINT' });
      await createMessage(app, 'bob', { content: 'bob msg 2', color: 'LEMON' });

      // alice 시점에서 조회
      const res = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(3);

      // is_mine 플래그: alice 가 작성한 1개만 true
      const mine = res.body.items.filter((m) => m.is_mine === true);
      const others = res.body.items.filter((m) => m.is_mine === false);
      expect(mine).toHaveLength(1);
      expect(mine[0].content).toBe('alice msg');
      expect(others).toHaveLength(2);

      // 모든 응답 항목에 authorId / author 키 절대 없어야 함
      for (const m of res.body.items) {
        expect(m.authorId).toBeUndefined();
        expect(m.author).toBeUndefined();
      }
    });

    it('정렬: createdAt desc (최신 위)', async () => {
      const r1 = await createMessage(app, 'alice', { content: 'first', color: 'PINK' });
      // 다음 메시지의 createdAt 이 다르게 잡히도록 짧게 대기
      await new Promise((r) => setTimeout(r, 5));
      const r2 = await createMessage(app, 'alice', { content: 'second', color: 'MINT' });
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);

      const res = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.items[0].content).toBe('second');
      expect(res.body.items[1].content).toBe('first');
    });
  });

  describe('DELETE /api/messages/:id', () => {
    it('비인증 → 401', async () => {
      const created = await createMessage(app, 'alice');
      const res = await request(app).delete(`/api/messages/${created.body.message.id}`);
      expect(res.status).toBe(401);
    });

    it('본인 메시지 삭제 → 204', async () => {
      const created = await createMessage(app, 'alice');
      const res = await request(app)
        .delete(`/api/messages/${created.body.message.id}`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(204);

      // 실제로 사라졌는지 GET 으로 확인
      const list = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(list.body.items).toHaveLength(0);
    });

    it('다른 유저 메시지 삭제 시도 → 403', async () => {
      const created = await createMessage(app, 'alice');
      const res = await request(app)
        .delete(`/api/messages/${created.body.message.id}`)
        .set('Authorization', `Bearer ${tokenFor('bob')}`);
      expect(res.status).toBe(403);

      // 실제로 삭제 안 됐는지 확인
      const list = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(list.body.items).toHaveLength(1);
    });

    it('미존재 id → 404', async () => {
      const res = await request(app)
        .delete('/api/messages/nonexistent_id')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/messages/:id', () => {
    it('비인증 → 401', async () => {
      const created = await createMessage(app, 'alice');
      const res = await request(app)
        .patch(`/api/messages/${created.body.message.id}`)
        .send({ content: '수정' });
      expect(res.status).toBe(401);
    });

    it('본인 메시지 수정 → 200 + 새 내용 반영', async () => {
      const created = await createMessage(app, 'alice');
      const res = await request(app)
        .patch(`/api/messages/${created.body.message.id}`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ content: '수정된 내용', color: 'LAVENDER' });
      expect(res.status).toBe(200);
      expect(res.body.message.content).toBe('수정된 내용');
      expect(res.body.message.color).toBe('LAVENDER');
      expect(res.body.message.is_mine).toBe(true);
      expect(res.body.message.authorId).toBeUndefined();
    });

    it('다른 유저 메시지 수정 시도 → 403', async () => {
      const created = await createMessage(app, 'alice');
      const res = await request(app)
        .patch(`/api/messages/${created.body.message.id}`)
        .set('Authorization', `Bearer ${tokenFor('bob')}`)
        .send({ content: '해킹시도', color: 'PINK' });
      expect(res.status).toBe(403);
    });

    it('미존재 id → 404', async () => {
      const res = await request(app)
        .patch('/api/messages/nonexistent_id')
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ content: 'x' });
      expect(res.status).toBe(404);
    });

    it('빈 body → 400', async () => {
      const created = await createMessage(app, 'alice');
      const res = await request(app)
        .patch(`/api/messages/${created.body.message.id}`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/health', () => {
    it('200 OK (public)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.service).toBe('letter-api');
    });
  });

  describe('CORS fail-closed', () => {
    it('CORS_ORIGINS 비면 cross-origin 미반사', async () => {
      const original = process.env.CORS_ORIGINS;
      process.env.CORS_ORIGINS = '';
      try {
        const closedApp = createApp({ rateLimitMax: 100 });
        const res = await request(closedApp)
          .get('/api/health')
          .set('Origin', 'https://evil.example');
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
        expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      } finally {
        if (original === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = original;
      }
    });
  });
});
