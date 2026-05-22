/**
 * hobby-api POST /api/posts owner.nickname 스냅샷 정책 (#562, #563).
 *
 * 별도 파일 이유 (CR #563): posts.test.js 가 300줄 한도 초과 — owner.nickname
 * 케이스만 분리해 한도 회복.
 *
 * 정책:
 *  - JWT.nickname 있으면 ownerName 에 nickname 박힘.
 *  - JWT.nickname 없으면 name 으로 폴백.
 *  - JWT.nickname 이 빈 문자열 / 공백만이면 truthy 분기 방어 — name 폴백 (CR/Gemini #563).
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

const SECRET = process.env.JWT_SECRET;

const future = (h = 24) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

const validBody = (overrides = {}) => ({
  title: '북문 마라탕 3명',
  body: '오늘 저녁 6시',
  meetAt: future(),
  capacity: 3,
  openChatUrl: 'https://open.kakao.com/o/test',
  tags: ['음식', '맛집'],
  ...overrides,
});

describe('POST /api/posts owner.nickname (#562, #563)', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  it('JWT.nickname 이 있으면 nickname 스냅샷 우선', async () => {
    const token = signJwt(
      { sub: 'alice', email: 'alice@get-it.cloud', name: 'A 본명', nickname: '에이짱' },
      SECRET,
    );
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.post.owner).toEqual({ nickname: '에이짱' });
  });

  it('JWT.nickname 없으면 name 으로 폴백', async () => {
    const token = signJwt({ sub: 'bob', email: 'bob@get-it.cloud', name: 'B 본명' }, SECRET);
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.post.owner).toEqual({ nickname: 'B 본명' });
  });

  it('JWT.nickname 빈 문자열이면 name 폴백 (CR #563)', async () => {
    const token = signJwt(
      { sub: 'charlie', email: 'c@get-it.cloud', name: 'C 본명', nickname: '' },
      SECRET,
    );
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.post.owner).toEqual({ nickname: 'C 본명' });
  });

  it('JWT.nickname 공백만이면 name 폴백 (Gemini medium #563)', async () => {
    const token = signJwt(
      { sub: 'dana', email: 'd@get-it.cloud', name: 'D 본명', nickname: '   ' },
      SECRET,
    );
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.post.owner).toEqual({ nickname: 'D 본명' });
  });
});
