/**
 * letter-api 메시지 보안 회귀 테스트 (issue #53).
 *
 * 익명성은 letter 의 SECURITY-CRITICAL invariant 다.
 * `apps/letter-api/src/routes/messages.js` 가 응답에서 authorId / author / user
 * 등을 노출하면 즉시 부원 신원이 깨진다 — 이 테스트는 그 회귀를 영구 락한다.
 *
 * `messages.test.js` 는 비잠금 (functional) 커버리지.
 * 이 파일은 잠금 (regression / contract) 전용:
 *   1) 응답 키 화이트리스트 — 허용 키만 정확히 일치 (extra key 0)
 *   2) snapshot — 응답 모양 통째로 freeze
 *   3) 다른 유저 시점에서 is_mine: false (cross-viewer)
 *   4) 응답 직렬화에 authorId 가 절대 새지 않음 (POST/GET/PATCH 전역)
 *   5) JOIN 흔적 (author 객체) 가 응답에 없음
 *
 * 향후 누가 라우터에서 `select` 를 빼먹거나 row 를 그대로 spread 해버리면
 * 여기서 빨갛게 막혀야 한다.
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import './setup.js';

const SECRET = process.env.JWT_SECRET;

const tokenFor = (sub, email = `${sub}@get-it.cloud`, name = sub) =>
  signJwt({ sub, email, name }, SECRET);

// updatedAt 은 응답에서 제거됨 (#251 — 편집 시점 누설 차단).
// createdAt 만 노출, 분 단위로 truncate (#250).
const ALLOWED_KEYS = ['id', 'content', 'color', 'createdAt', 'is_mine'];
const FORBIDDEN_KEYS = [
  'authorId',
  'author_id',
  'author',
  'user',
  'userId',
  'user_id',
  // updatedAt 도 forbidden — 편집 시점 누설 (#251).
  'updatedAt',
  'updated_at',
];

const createMessage = (app, sub, content = '익명 인사', color = 'PINK') =>
  request(app)
    .post('/api/messages')
    .set('Authorization', `Bearer ${tokenFor(sub)}`)
    .send({ content, color });

describe('letter-api messages — security regression (#53)', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  describe('응답 키 화이트리스트 — extra/forbidden key 차단', () => {
    it('POST /api/messages 응답 message 키가 화이트리스트와 정확히 일치', async () => {
      const res = await createMessage(app, 'alice');
      expect(res.status).toBe(201);

      const keys = Object.keys(res.body.message).sort();
      expect(keys).toEqual([...ALLOWED_KEYS].sort());

      for (const k of FORBIDDEN_KEYS) {
        expect(res.body.message[k]).toBeUndefined();
      }
    });

    it('GET /api/messages 모든 item 키가 화이트리스트와 정확히 일치', async () => {
      await createMessage(app, 'alice', 'a', 'PINK');
      await createMessage(app, 'bob', 'b', 'MINT');

      const res = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);

      for (const item of res.body.items) {
        expect(Object.keys(item).sort()).toEqual([...ALLOWED_KEYS].sort());
        for (const k of FORBIDDEN_KEYS) {
          expect(item[k]).toBeUndefined();
        }
      }
    });

    it('PATCH /api/messages/:id 응답 message 키가 화이트리스트와 정확히 일치', async () => {
      const created = await createMessage(app, 'alice');
      const res = await request(app)
        .patch(`/api/messages/${created.body.message.id}`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ content: '수정', color: 'LAVENDER' });
      expect(res.status).toBe(200);

      expect(Object.keys(res.body.message).sort()).toEqual([...ALLOWED_KEYS].sort());
      for (const k of FORBIDDEN_KEYS) {
        expect(res.body.message[k]).toBeUndefined();
      }
    });
  });

  describe('snapshot — 응답 모양 freeze', () => {
    it('GET /api/messages 응답 모양이 contract 와 정확히 일치', async () => {
      const created = await createMessage(app, 'alice', 'snapshot test', 'MINT');
      expect(created.status).toBe(201);

      const res = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);

      // ISO date 와 id 는 런타임 가변 → 정규화 후 snapshot.
      // updatedAt 은 응답에서 제거 (#251). createdAt 만 노출 + 분 단위 truncate (#250).
      const normalized = {
        items: res.body.items.map((m) => ({
          ...m,
          id: '<id>',
          createdAt: '<iso>',
        })),
      };
      expect(normalized).toEqual({
        items: [
          {
            id: '<id>',
            content: 'snapshot test',
            color: 'MINT',
            createdAt: '<iso>',
            is_mine: true,
          },
        ],
      });
    });

    it('POST 응답 모양이 contract 와 정확히 일치', async () => {
      const res = await createMessage(app, 'alice', 'snap post', 'LEMON');
      expect(res.status).toBe(201);

      const m = res.body.message;
      expect({
        ...m,
        id: '<id>',
        createdAt: '<iso>',
      }).toEqual({
        id: '<id>',
        content: 'snap post',
        color: 'LEMON',
        createdAt: '<iso>',
        is_mine: true,
      });
    });
  });

  describe('cross-viewer is_mine — 익명성 핵심', () => {
    it('alice 메시지를 bob 토큰으로 조회 시 is_mine: false', async () => {
      const aliceSub = 'sub_alice_unique_zzz';
      const created = await createMessage(app, aliceSub, '익명 본문 only', 'PINK');
      expect(created.status).toBe(201);

      const res = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${tokenFor('sub_bob_unique_qqq')}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);

      const createdId = created.body.message.id;
      const item = res.body.items.find((m) => m.id === createdId);
      expect(item).toBeDefined();
      expect(item.is_mine).toBe(false);
      // 어떤 형태로든 작성자 sub 가 응답에 새면 안 됨
      const serialized = JSON.stringify(item);
      expect(serialized).not.toContain(aliceSub);
    });

    it('동일 메시지를 본인/타인 토큰으로 조회 시 is_mine 만 다르고 나머지 동일', async () => {
      const created = await createMessage(app, 'alice', 'identical body', 'LAVENDER');
      expect(created.status).toBe(201);

      const [meRes, otherRes] = await Promise.all([
        request(app)
          .get('/api/messages')
          .set('Authorization', `Bearer ${tokenFor('alice')}`),
        request(app)
          .get('/api/messages')
          .set('Authorization', `Bearer ${tokenFor('bob')}`),
      ]);

      expect(meRes.status).toBe(200);
      expect(otherRes.status).toBe(200);

      const createdId = created.body.message.id;
      const mine = meRes.body.items.find((m) => m.id === createdId);
      const other = otherRes.body.items.find((m) => m.id === createdId);
      expect(mine).toBeDefined();
      expect(other).toBeDefined();

      expect(mine.is_mine).toBe(true);
      expect(other.is_mine).toBe(false);

      // is_mine 외 모든 필드는 동일해야 함 (응답이 viewer 별로 분기되면 안 됨)
      expect({ ...mine, is_mine: undefined }).toEqual({ ...other, is_mine: undefined });
    });
  });

  describe('timing 안전성 — createdAt 분 단위 truncate / updatedAt 미노출 (#250, #251)', () => {
    it('createdAt 의 초/ms 자리는 00.000Z 로 잘려있다', async () => {
      const res = await createMessage(app, 'alice', 'timing test', 'PINK');
      expect(res.status).toBe(201);
      // ISO 8601 의 마지막 6자리 (`SS.sssZ`) 는 분 단위 truncate 후 `00.000Z` 고정.
      expect(res.body.message.createdAt).toMatch(/T\d{2}:\d{2}:00\.000Z$/);
    });

    it('GET 의 모든 item createdAt 도 동일하게 분 단위 truncate', async () => {
      await createMessage(app, 'alice', 'a', 'PINK');
      await createMessage(app, 'bob', 'b', 'MINT');

      const res = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${tokenFor('alice')}`);
      expect(res.status).toBe(200);
      for (const item of res.body.items) {
        expect(item.createdAt).toMatch(/T\d{2}:\d{2}:00\.000Z$/);
      }
    });

    it('PATCH 응답에 updatedAt 키가 없다 (편집 시점 누설 차단)', async () => {
      const created = await createMessage(app, 'alice', 'before', 'PINK');
      const res = await request(app)
        .patch(`/api/messages/${created.body.message.id}`)
        .set('Authorization', `Bearer ${tokenFor('alice')}`)
        .send({ content: 'after' });
      expect(res.status).toBe(200);
      expect(res.body.message.updatedAt).toBeUndefined();
      expect(res.body.message.updated_at).toBeUndefined();
    });
  });

  describe('직렬화 안전성 — author 식별자 누출 차단', () => {
    it('GET 응답 raw JSON 어디에도 author 식별자 substring 없음', async () => {
      // 충분히 길고 검색 가능한 sub 들 사용
      await createMessage(app, 'alice_uid_aaa', 'm1', 'PINK');
      await createMessage(app, 'bob_uid_bbb', 'm2', 'MINT');
      await createMessage(app, 'carol_uid_ccc', 'm3', 'LEMON');

      const res = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${tokenFor('viewer_zzz')}`);
      expect(res.status).toBe(200);

      const raw = JSON.stringify(res.body);
      // 작성자 sub 들이 raw JSON 어디에도 나와선 안 됨
      expect(raw).not.toContain('alice_uid_aaa');
      expect(raw).not.toContain('bob_uid_bbb');
      expect(raw).not.toContain('carol_uid_ccc');

      // 응답 wrapper 도 author 흔적 없는지
      expect(raw).not.toMatch(/"sub"\s*:/);
      expect(raw).not.toMatch(/"author(Id|_id)?"\s*:/);
      expect(raw).not.toMatch(/"user(Id|_id)?"\s*:/);
    });

    it('POST 직후 응답 raw JSON 에 작성자 sub substring 없음', async () => {
      const res = await createMessage(app, 'unique_sub_xyz', 'hello', 'PINK');
      expect(res.status).toBe(201);

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('unique_sub_xyz');
      expect(raw).not.toMatch(/"sub"\s*:/);
      expect(raw).not.toMatch(/"author(Id|_id)?"\s*:/);
      expect(raw).not.toMatch(/"user(Id|_id)?"\s*:/);
    });

    it('PATCH 응답 raw JSON 에 작성자 sub substring 없음', async () => {
      const created = await createMessage(app, 'patch_sub_qqq', 'before', 'PINK');
      const res = await request(app)
        .patch(`/api/messages/${created.body.message.id}`)
        .set('Authorization', `Bearer ${tokenFor('patch_sub_qqq')}`)
        .send({ content: 'after' });
      expect(res.status).toBe(200);

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('patch_sub_qqq');
      expect(raw).not.toMatch(/"sub"\s*:/);
      expect(raw).not.toMatch(/"author(Id|_id)?"\s*:/);
      expect(raw).not.toMatch(/"user(Id|_id)?"\s*:/);
    });
  });
});
