/**
 * hobby-api 신청 race condition 보강 시나리오 — #439.
 *
 * 기존 applications.test.js 가 "capacity=2, 남은 1자리에 5명 동시" 케이스를 다룸.
 * 이 파일은 #439 DoD 의 추가 3 시나리오:
 *  1. 같은 사용자 동일 post 두 번 동시 신청 (두 탭 흉내) → 정확히 1번만 201, 1번 409
 *  2. capacity=1 두 사용자 동시 → 한쪽 201, 다른쪽 422
 *  3. 신청 직후 cancel 직후 재신청 (sequential, replay 가능)
 */
import { signJwt } from '@getit/auth-utils/server';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { memDb } from './setup.js';

const SECRET = process.env.JWT_SECRET;
const tokenFor = (sub) => signJwt({ sub, email: `${sub}@get-it.cloud`, name: sub }, SECRET);
const future = (h = 24) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

const postBody = (overrides = {}) => ({
  title: '북문 마라탕',
  body: '오늘 저녁 6시',
  meetAt: future(),
  capacity: 3,
  openChatUrl: 'https://open.kakao.com/o/test',
  tags: ['음식'],
  ...overrides,
});

const createPostAs = (app, owner, overrides = {}) =>
  request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${tokenFor(owner)}`)
    .send(postBody(overrides));

const applyAs = (app, user, postId) =>
  request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ postId });

const cancelAs = (app, user, appId) =>
  request(app)
    .delete(`/api/applications/${appId}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`);

describe('hobby-api applications race — #439', () => {
  /** @type {import('express').Express} */
  let app;
  beforeAll(() => {
    app = createApp({ rateLimitMax: 100_000 });
  });

  it('같은 사용자 두 탭 동시 신청 → 정확히 한 번만 201, 다른 한 번 409', async () => {
    const created = await createPostAs(app, 'alice', { capacity: 5 });
    const postId = created.body.post.id;

    // 같은 사용자가 두 탭에서 동시 발사 (Promise.all 로 인터리브).
    const [r1, r2] = await Promise.all([applyAs(app, 'bob', postId), applyAs(app, 'bob', postId)]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const rejected = [r1, r2].find((r) => r.status === 409);
    expect(rejected.body.error).toBe('AlreadyApplied');

    // capacity 정확히 1 (over-counted 면 안 됨).
    expect(memDb.posts.get(postId).currentCapacity).toBe(1);
    // applications 정확히 1건.
    expect(memDb.applications.size).toBe(1);
  });

  // schema capacity min=2 (방장 포함). 남은 1자리 시나리오 = 1명 seed 후 두 명 동시 신청.
  it('남은 1자리에 두 사용자 동시 신청 → 정확히 한 명만 201', async () => {
    const created = await createPostAs(app, 'alice', { capacity: 2 });
    const postId = created.body.post.id;
    // 자리 1개 미리 채워서 1/2 상태로.
    const seed = await applyAs(app, 'seed', postId);
    expect(seed.status).toBe(201);
    expect(memDb.posts.get(postId).currentCapacity).toBe(1);

    const [r1, r2] = await Promise.all([
      applyAs(app, 'bob', postId),
      applyAs(app, 'carol', postId),
    ]);
    const successes = [r1, r2].filter((r) => r.status === 201);
    const rejects = [r1, r2].filter((r) => r.status !== 201);
    expect(successes).toHaveLength(1);
    expect(rejects).toHaveLength(1);
    expect(rejects[0].status).toBe(422);
    expect(['PostFull', 'PostNotOpen']).toContain(rejects[0].body.error);

    // 정원 정확히 채워지고 FULL 전이.
    expect(memDb.posts.get(postId).currentCapacity).toBe(2);
    expect(memDb.posts.get(postId).status).toBe('FULL');
    expect(memDb.applications.size).toBe(2);
  });

  it('신청 → cancel → 재신청 (sequential replay) → 정상', async () => {
    const created = await createPostAs(app, 'alice');
    const postId = created.body.post.id;

    const a1 = await applyAs(app, 'bob', postId);
    expect(a1.status).toBe(201);
    expect(memDb.posts.get(postId).currentCapacity).toBe(1);

    const cancel = await cancelAs(app, 'bob', a1.body.application.id);
    expect(cancel.status).toBe(204);
    expect(memDb.posts.get(postId).currentCapacity).toBe(0);
    expect(memDb.applications.size).toBe(0);

    const a2 = await applyAs(app, 'bob', postId);
    expect(a2.status).toBe(201);
    expect(memDb.posts.get(postId).currentCapacity).toBe(1);
    expect(memDb.applications.size).toBe(1);
  });
});
