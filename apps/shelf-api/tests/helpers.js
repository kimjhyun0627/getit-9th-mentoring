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
 * #561: nickname 옵션 인자 추가 — browse 부원 디렉토리 스냅샷 테스트용.
 *
 * @param {string} sub
 * @param {{ name?: string, nickname?: string | null }} [opts]
 * @returns {string}
 */
export const signFor = (sub, opts = {}) =>
  jwt.sign(
    {
      sub,
      email: `${sub}@get-it.cloud`,
      name: opts.name ?? sub,
      ...(opts.nickname !== undefined ? { nickname: opts.nickname } : {}),
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );

/**
 * supertest 의 `.set()` 에 그대로 넣을 수 있는 인증 헤더.
 *
 * @param {string} sub
 * @param {{ name?: string, nickname?: string | null }} [opts]
 * @returns {{ Cookie: string }}
 */
export const authHeader = (sub, opts) => ({ Cookie: `getit_jwt=${signFor(sub, opts)}` });

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
