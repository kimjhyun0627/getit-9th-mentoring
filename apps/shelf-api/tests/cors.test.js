/**
 * CORS fail-closed 운영 검증 (#273).
 *
 * `CORS_ORIGINS` 가 비어있거나 미설정이면:
 *   - cross-origin 요청은 Access-Control-Allow-Origin 헤더가 붙지 않아야 함
 *   - credentials (Set-Cookie) 도 허용되지 않아야 함
 *
 * 운영자가 .env 채우기 전에는 안전하게 거부 — fail-open 되면 다른 도메인이
 * 인증 쿠키를 들고 API 를 호출할 수 있는 보안 사고.
 */
import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';

describe('CORS fail-closed (#273)', () => {
  it('CORS_ORIGINS 미설정 시 Access-Control-Allow-Origin 헤더 부착 안 됨', async () => {
    const original = process.env.CORS_ORIGINS;
    delete process.env.CORS_ORIGINS;
    try {
      const app = createApp({ rateLimitMax: 1000 });
      const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    } finally {
      // undefined 를 그대로 대입하면 "undefined" 문자열로 박히므로 분기 복구 (CR #346).
      if (original === undefined) delete process.env.CORS_ORIGINS;
      else process.env.CORS_ORIGINS = original;
    }
  });

  it('CORS_ORIGINS 빈 문자열 시에도 fail-closed', async () => {
    const original = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = '';
    try {
      const app = createApp({ rateLimitMax: 1000 });
      const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      // undefined 를 그대로 대입하면 "undefined" 문자열로 박히므로 분기 복구 (CR #346).
      if (original === undefined) delete process.env.CORS_ORIGINS;
      else process.env.CORS_ORIGINS = original;
    }
  });

  it('CORS_ORIGINS 명시 시 매칭 origin 만 허용', async () => {
    const original = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = 'https://shelf.get-it.cloud';
    try {
      const app = createApp({ rateLimitMax: 1000 });
      const ok = await request(app).get('/api/health').set('Origin', 'https://shelf.get-it.cloud');
      expect(ok.headers['access-control-allow-origin']).toBe('https://shelf.get-it.cloud');
      expect(ok.headers['access-control-allow-credentials']).toBe('true');

      const bad = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
      // cors() 가 매치 안 되면 헤더 자체 미부착 → 브라우저가 거부.
      expect(bad.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      // undefined 를 그대로 대입하면 "undefined" 문자열로 박히므로 분기 복구 (CR #346).
      if (original === undefined) delete process.env.CORS_ORIGINS;
      else process.env.CORS_ORIGINS = original;
    }
  });
});
