/**
 * GET /api/healthz — 모니터링/canary 친화 health endpoint (#441).
 *
 * - 200: DB 응답 정상 → { status: 'ok', db: 'reachable' }
 * - 503: DB 다운 → { status: 'error', db: 'unreachable' }
 * - rate-limit 면제 (모니터링이 자주 호출)
 * - GET 만 허용
 */
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

describe('GET /api/healthz', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('DB 정상 → 200 + { status, db, service }', async () => {
    const res = await request(app).get('/api/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      db: 'reachable',
      service: 'hobby-api',
    });
  });

  it('DB ping 실패 → 503 + db=unreachable', async () => {
    const { prisma } = await import('../src/lib/prisma.js');
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/api/healthz');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', db: 'unreachable' });
  });

  it('rate-limit 면제 — 대량 호출 200 유지', async () => {
    // mutationLimiter 는 POST/PATCH/DELETE 전용이라 GET healthz 는 본디 영향 없음.
    // 다만 future-proofing: 별도 limit 없이 100회 가도 200.
    const results = await Promise.all(
      Array.from({ length: 20 }, () => request(app).get('/api/healthz')),
    );
    for (const r of results) expect(r.status).toBe(200);
  });
});
