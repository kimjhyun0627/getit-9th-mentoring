/**
 * letter-api 다중 사용자 익명성 E2E (issue #322).
 *
 * `messages.test.js` 는 단일 사용자 + 기본 권한 검증.
 * `messages.security.test.js` 는 응답 모양/snapshot 회귀.
 * 여기는 "여러 사용자 토큰" 시나리오로 익명성 invariant 를 다시 한번 확정.
 *
 * 시나리오 (5):
 *  1. A 작성 → B 조회: is_mine=false, authorId/author/sub 누설 없음
 *  2. B 가 A 메시지 PATCH 시도: 403 + A 식별자 노출 X
 *  3. B 가 A 메시지 DELETE 시도: 403 + 메시지 보존
 *  4. A 본인 PATCH 200 + content 갱신
 *  5. 미존재 메시지 PATCH/DELETE: 404 (응답 모양/타이밍 부근 회귀)
 *
 * "다른 사람 소유 vs 미존재" 응답 모양은 동일해야 함 (둘 다 error 필드만,
 * authorId 등 누설 X). timing oracle 정량 비교는 환경 노이즈가 커서 본 테스트는
 * "모양 동일" 까지만 검증 — 추가 강화는 별도 이슈.
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

const SECRET = process.env.JWT_SECRET;
const tokenFor = (sub) => signJwt({ sub, email: `${sub}@get-it.cloud`, name: sub }, SECRET);

const post = (app, sub, body) =>
  request(app)
    .post('/api/messages')
    .set('Authorization', `Bearer ${tokenFor(sub)}`)
    .send(body);

describe('letter-api 다중 사용자 익명성 E2E (#322)', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  // 시나리오 1
  it('A 작성 → B 조회: is_mine=false + 작성자 식별자 누설 없음', async () => {
    const aliceSub = 'aliceSubE2E';
    const bobSub = 'bobSubE2E';
    const created = await post(app, aliceSub, { content: '안녕!', color: 'PINK' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${tokenFor(bobSub)}`);
    expect(res.status).toBe(200);

    const item = res.body.items.find((m) => m.id === created.body.message.id);
    expect(item).toBeDefined();
    expect(item.is_mine).toBe(false);
    expect(item.content).toBe('안녕!');

    // 응답 전체에 author 식별자 substring 없음
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(aliceSub);
    expect(raw).not.toContain(bobSub);
    expect(raw).not.toMatch(/"authorId"\s*:/);
    expect(raw).not.toMatch(/"author"\s*:/);
  });

  // 시나리오 2
  it('B 가 A 메시지 PATCH 시도 → 403 + A 식별자 노출 X', async () => {
    const created = await post(app, 'aliceX', { content: 'A msg', color: 'MINT' });
    const res = await request(app)
      .patch(`/api/messages/${created.body.message.id}`)
      .set('Authorization', `Bearer ${tokenFor('bobX')}`)
      .send({ content: '몰래 수정' });
    expect(res.status).toBe(403);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('aliceX');
    expect(raw).not.toContain('bobX');
    expect(raw).not.toMatch(/"author/i);

    // 본문이 안 바뀌었는지 알리스 시점에서 확인
    const list = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${tokenFor('aliceX')}`);
    const item = list.body.items.find((m) => m.id === created.body.message.id);
    expect(item.content).toBe('A msg');
  });

  // 시나리오 3
  it('B 가 A 메시지 DELETE 시도 → 403 + 메시지 보존', async () => {
    const created = await post(app, 'aliceD', { content: 'keep me', color: 'LEMON' });
    const res = await request(app)
      .delete(`/api/messages/${created.body.message.id}`)
      .set('Authorization', `Bearer ${tokenFor('bobD')}`);
    expect(res.status).toBe(403);

    const list = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${tokenFor('aliceD')}`);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].content).toBe('keep me');
  });

  // 시나리오 4
  it('A 본인 PATCH → 200 + content 갱신 + is_mine=true', async () => {
    const created = await post(app, 'aliceP', { content: 'before', color: 'PINK' });
    const res = await request(app)
      .patch(`/api/messages/${created.body.message.id}`)
      .set('Authorization', `Bearer ${tokenFor('aliceP')}`)
      .send({ content: 'after' });
    expect(res.status).toBe(200);
    expect(res.body.message.content).toBe('after');
    expect(res.body.message.is_mine).toBe(true);
    expect(res.body.message.authorId).toBeUndefined();
    expect(res.body.message.updatedAt).toBeUndefined();
  });

  // 시나리오 5 — 미존재 메시지: 응답 모양 = 다른 사람 소유와 동일 (둘 다 error 키만)
  // CR #335: status 코드도 같이 잠가서 403/404 분기 회귀 방지.
  it('미존재 vs 타인 소유 응답 모양 동일 (PATCH)', async () => {
    const otherOwned = await post(app, 'aliceShape', { content: 'x', color: 'PINK' });
    const otherRes = await request(app)
      .patch(`/api/messages/${otherOwned.body.message.id}`)
      .set('Authorization', `Bearer ${tokenFor('bobShape')}`)
      .send({ content: 'x' });

    const notFoundRes = await request(app)
      .patch('/api/messages/missing_id_xyz')
      .set('Authorization', `Bearer ${tokenFor('bobShape')}`)
      .send({ content: 'x' });

    // status 분기 회귀 방지 (CR #335) — 403 vs 404 가 섞이거나 한쪽으로 무너지면 잡힌다.
    expect(otherRes.status).toBe(403);
    expect(notFoundRes.status).toBe(404);
    // status 는 다르지만 (403 vs 404) 응답 모양은 둘 다 `{ error: string }` 만.
    expect(Object.keys(otherRes.body).sort()).toEqual(['error']);
    expect(Object.keys(notFoundRes.body).sort()).toEqual(['error']);
  });

  it('미존재 vs 타인 소유 응답 모양 동일 (DELETE)', async () => {
    const otherOwned = await post(app, 'aliceShapeD', { content: 'x', color: 'PINK' });
    const otherRes = await request(app)
      .delete(`/api/messages/${otherOwned.body.message.id}`)
      .set('Authorization', `Bearer ${tokenFor('bobShapeD')}`);

    const notFoundRes = await request(app)
      .delete('/api/messages/missing_id_xyz')
      .set('Authorization', `Bearer ${tokenFor('bobShapeD')}`);

    // status 분기 회귀 방지 (CR #335).
    expect(otherRes.status).toBe(403);
    expect(notFoundRes.status).toBe(404);
    expect(Object.keys(otherRes.body).sort()).toEqual(['error']);
    expect(Object.keys(notFoundRes.body).sort()).toEqual(['error']);
  });
});
