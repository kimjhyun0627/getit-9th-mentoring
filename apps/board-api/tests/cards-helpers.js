/**
 * cards.*.test.js 공유 헬퍼.
 *
 * 카드 테스트가 endpoint 단위로 분리되며 공통으로 쓰는 헬퍼만 모아둔다.
 * (300줄 룰 — 테스트 파일 분리 시 setup/유틸 중복 방지)
 */
import request from 'supertest';

import { authHeader } from './helpers.js';
import { memDb } from './setup.js';

/**
 * 프로젝트의 컬럼들을 order asc 로 반환.
 *
 * @param {string} projectId
 * @returns {{ id: string, name: string, order: number, projectId: string }[]}
 */
export const columnsOf = (projectId) =>
  [...memDb.boardColumns.values()]
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.order - b.order);

/**
 * 카드 생성 헬퍼 — 201 응답 보장 후 카드 row 반환.
 *
 * @param {import('express').Express} app
 * @param {string} userSub
 * @param {string} columnId
 * @param {Record<string, unknown>} [body]
 */
export const createCard = async (app, userSub, columnId, body = {}) => {
  const res = await request(app)
    .post('/api/cards')
    .set(authHeader(userSub))
    .send({ columnId, title: 'T', ...body });
  if (res.status !== 201) {
    throw new Error(
      `createCard setup failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }
  return res.body.card;
};
