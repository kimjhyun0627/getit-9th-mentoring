/**
 * 테스트 헬퍼 — JWT 발급 + Cookie 헤더 빌더 + Book 시드.
 *
 * SECRET 은 setup.js 에서 process.env.JWT_SECRET 으로 세팅되며,
 * 본 모듈은 import 시점이 아니라 호출 시점에 env 를 읽는다 (setup이 먼저 돌도록).
 */
import jwt from 'jsonwebtoken';

import { prisma } from '../src/lib/prisma.js';

/**
 * 테스트용 access JWT 발급. requireAuth가 디코드하는 payload shape에 맞춤.
 *
 * @param {string} sub
 * @returns {string}
 */
export const signFor = (sub) =>
  jwt.sign({ sub, email: `${sub}@get-it.cloud`, name: sub }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });

/**
 * supertest 의 `.set()` 에 그대로 넣을 수 있는 인증 헤더.
 *
 * @param {string} sub
 * @returns {{ Cookie: string }}
 */
export const authHeader = (sub) => ({ Cookie: `getit_jwt=${signFor(sub)}` });

/**
 * 테스트용 Book 시드 — 기본값 + overrides.
 *
 * @param {Record<string, any>} [overrides]
 * @returns {Promise<Record<string, any>>}
 */
export const seedBook = (overrides = {}) =>
  prisma.book.upsert({
    where: { isbn: overrides.isbn ?? '9788932917245' },
    create: {
      isbn: overrides.isbn ?? '9788932917245',
      title: overrides.title ?? '소년이 온다',
      author: overrides.author ?? '한강',
      publisher: overrides.publisher ?? '창비',
      publishedAt: overrides.publishedAt ?? new Date('2014-05-19'),
      coverUrl: overrides.coverUrl ?? 'https://example.com/cover.jpg',
      description: overrides.description ?? '광주 5·18',
      source: overrides.source ?? 'kakao',
    },
    update: {},
  });
