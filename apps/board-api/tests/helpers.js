/**
 * 테스트 헬퍼 — JWT 발급 + Cookie 헤더 빌더.
 *
 * SECRET은 `setup.js` 에서 process.env.JWT_SECRET 으로 세팅되며,
 * 본 모듈은 import 시점이 아니라 호출 시점에 env를 읽는다 (setup이 먼저 돌도록).
 */
import jwt from 'jsonwebtoken';

/**
 * 테스트용 access JWT 발급. requireAuth가 디코드하는 payload shape에 맞춤.
 *
 * @param {string} sub
 * @param {string} [email]
 * @param {string} [name]
 * @returns {string}
 */
export const signFor = (sub, email = `${sub}@get-it.cloud`, name = sub) =>
  jwt.sign({ sub, email, name }, process.env.JWT_SECRET, { expiresIn: '15m' });

/**
 * supertest 의 `.set()` 에 그대로 넣을 수 있는 인증 헤더.
 *
 * @param {string} sub
 * @returns {{ Cookie: string }}
 */
export const authHeader = (sub) => ({ Cookie: `getit_jwt=${signFor(sub)}` });

/**
 * 프로젝트를 즉시 생성해 id를 돌려준다 — 멤버 테스트 케이스마다 반복 setup 줄임.
 * setup 단계 실패가 본 검증을 오염시키지 않도록 201 + project.id 를 먼저 확인한다.
 *
 * @param {import('supertest').SuperTest<import('supertest').Test>} request
 * @param {import('express').Express} app
 * @param {string} ownerSub
 * @param {{ name?: string }} [body]
 * @returns {Promise<string>} project id
 */
export const createProject = async (request, app, ownerSub, body = {}) => {
  const res = await request(app)
    .post('/api/projects')
    .set(authHeader(ownerSub))
    .send({ name: body.name ?? 'TestProject' });
  if (res.status !== 201 || !res.body?.project?.id) {
    throw new Error(
      `createProject setup failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }
  return res.body.project.id;
};

/**
 * 멤버 초대 setup 헬퍼. 201 응답을 보장해 setup 누락을 즉시 노출.
 *
 * @param {import('supertest').SuperTest<import('supertest').Test>} request
 * @param {import('express').Express} app
 * @param {string} projectId
 * @param {string} ownerSub OWNER 의 sub (alice 등)
 * @param {string} inviteeSub
 * @returns {Promise<void>}
 */
export const inviteMember = async (request, app, projectId, ownerSub, inviteeSub) => {
  const res = await request(app)
    .post(`/api/projects/${projectId}/members`)
    .set(authHeader(ownerSub))
    .send({ userId: inviteeSub });
  if (res.status !== 201) {
    throw new Error(
      `inviteMember setup failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }
};
