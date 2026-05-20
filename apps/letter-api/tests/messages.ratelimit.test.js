/**
 * letter-api rate-limit 회귀 테스트 (#252, #326).
 *
 * - GET /api/messages — polling oracle 차단용 readLimiter (분당 60 기본)
 * - POST /api/messages — mutationLimiter (분당 30 기본)
 *
 * 응답 본문 + 표준 헤더 (RateLimit-*) 검증.
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

const SECRET = process.env.JWT_SECRET;
const tokenFor = (sub) => signJwt({ sub, email: `${sub}@get-it.cloud`, name: sub }, SECRET);

describe('letter-api rate limiting', () => {
  describe('GET /api/messages — readLimiter (#252)', () => {
    /** @type {import('express').Express} */
    let app;
    /** @type {string} */
    let token;

    beforeAll(() => {
      // 작은 readRateLimitMax 로 줄여서 폭주 시뮬레이션. mutation 은 free.
      app = createApp({ rateLimitMax: 1000, readRateLimitMax: 3 });
      token = tokenFor('reader');
    });

    it('readRateLimitMax 초과 GET 은 429 + RateLimitExceeded', async () => {
      // 3번까지 200, 4번째 429.
      for (let i = 0; i < 3; i += 1) {
        const ok = await request(app).get('/api/messages').set('Authorization', `Bearer ${token}`);
        expect(ok.status).toBe(200);
      }
      const blocked = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${token}`);
      expect(blocked.status).toBe(429);
      expect(blocked.body).toEqual({ error: 'RateLimitExceeded' });
      // express-rate-limit standardHeaders: true → RateLimit-Reset 등 노출.
      // FE 가 Retry-After 카운트다운에 활용 (#326).
      expect(blocked.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('POST /api/messages — mutationLimiter (#326)', () => {
    /** @type {import('express').Express} */
    let app;
    /** @type {string} */
    let token;

    beforeAll(() => {
      // mutation 작게, read 는 free.
      app = createApp({ rateLimitMax: 2, readRateLimitMax: 1000 });
      token = tokenFor('writer');
    });

    it('mutation 임계값 초과 POST 는 429 + Retry-After 가능 헤더', async () => {
      for (let i = 0; i < 2; i += 1) {
        const ok = await request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${token}`)
          .send({ content: `m${i}`, color: 'PINK' });
        expect(ok.status).toBe(201);
      }
      const blocked = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'spam', color: 'PINK' });
      expect(blocked.status).toBe(429);
      expect(blocked.body).toEqual({ error: 'RateLimitExceeded' });
      expect(blocked.headers['ratelimit-reset']).toBeDefined();
    });
  });

  // CR #345 — mutation limiter 는 PATCH / DELETE 도 동일 회귀 보장 필요.
  describe('PATCH /api/messages/:id — mutationLimiter (#326)', () => {
    it('PATCH 임계 초과 시 429 + RateLimitExceeded', async () => {
      const app = createApp({ rateLimitMax: 3, readRateLimitMax: 1000 });
      const token = tokenFor('patcher');
      // 메시지 1개 만들고 (POST 1회 소비), PATCH 로 quota 소진.
      const created = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'origin', color: 'PINK' });
      expect(created.status).toBe(201);
      const id = created.body.message.id;

      // POST 1 + PATCH 2 = quota 3. 다음 PATCH 가 차단돼야 함.
      for (let i = 0; i < 2; i += 1) {
        const r = await request(app)
          .patch(`/api/messages/${id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ content: `edit-${i}` });
        expect(r.status).toBe(200);
      }
      const blocked = await request(app)
        .patch(`/api/messages/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'over' });
      expect(blocked.status).toBe(429);
      expect(blocked.body).toEqual({ error: 'RateLimitExceeded' });
      expect(blocked.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('DELETE /api/messages/:id — mutationLimiter (#326)', () => {
    it('DELETE 임계 초과 시 429 + RateLimitExceeded', async () => {
      const app = createApp({ rateLimitMax: 3, readRateLimitMax: 1000 });
      const token = tokenFor('deleter');
      // 3개 만들고 (POST 3회 소비) — 추가 DELETE 는 즉시 429.
      const ids = [];
      for (let i = 0; i < 3; i += 1) {
        const r = await request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${token}`)
          .send({ content: `m${i}`, color: 'PINK' });
        expect(r.status).toBe(201);
        ids.push(r.body.message.id);
      }
      const blocked = await request(app)
        .delete(`/api/messages/${ids[0]}`)
        .set('Authorization', `Bearer ${token}`);
      expect(blocked.status).toBe(429);
      expect(blocked.body).toEqual({ error: 'RateLimitExceeded' });
      expect(blocked.headers['ratelimit-reset']).toBeDefined();
    });
  });
});
