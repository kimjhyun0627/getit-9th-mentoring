/**
 * GET /api/posts cursor 검증 (#267).
 *
 * 잘못된 cursor 가 들어왔을 때 500 대신 400 ValidationError 로 응답해야 한다.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

describe('GET /api/posts cursor 검증', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  it('존재하지 않는 cursor → 400 ValidationError (500 아님)', async () => {
    const res = await request(app).get('/api/posts?cursor=does-not-exist-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
    expect(res.body.issues?.[0]?.path).toBe('cursor');
  });

  it('빈 cursor → 400 ValidationError (Zod min(1))', async () => {
    const res = await request(app).get('/api/posts?cursor=');
    // cursor 가 빈 문자열이면 Zod 가 min(1) 으로 거부.
    expect(res.status).toBe(400);
  });

  it('cursor 미전송 → 200', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
  });
});
