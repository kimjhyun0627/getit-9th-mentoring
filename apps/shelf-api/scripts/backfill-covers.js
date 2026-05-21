#!/usr/bin/env node
/**
 * #507 — Kakao thumb 서버 403 (op not allowed) 회피용 백필.
 *
 * 배경:
 * - PR #366 + #490 백필이 `Book.coverUrl` 을 `R480x696` 으로 갈아끼웠으나
 *   Kakao thumb 서버는 임의 사이즈 변환을 거부 (403). 라이브 책 표지 깨짐.
 * - kakao.js 의 `extractKakaoOriginUrl` 로 fname 쿼리의 원본 daumcdn URL 을
 *   직접 사용하도록 전환 (#507). 신규/갱신 row 는 자동으로 원본 URL 로 박힘.
 * - 기존 캐시된 row (kakaocdn thumb URL, 사이즈 무관) 는 만료까지 깨진 상태 유지.
 *   이 스크립트가 일회성으로 모두 원본 URL 로 백필.
 *
 * 범위:
 * - `coverUrl` 이 `kakaocdn.net/thumb/` 인 모든 row (R120x174 / R480x696 / R300x436 등).
 * - hostname 정확 매칭 + fname 쿼리 추출. 외부 호스트는 절대 손대지 않는다.
 *
 * 실행 (운영 VM):
 *   cd /opt/getit && docker compose --env-file infra/.env.prod \
 *     -f infra/docker-compose.prod.yml exec -T shelf-api node scripts/backfill-covers.js
 *
 * Dry-run:
 *   node scripts/backfill-covers.js --dry
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');
const BATCH = 200;

/**
 * kakao.js 의 extractKakaoOriginUrl 과 동일 정책.
 * 단발성 실행이라 import 경로 의존 최소화 — 이 파일 단독으로 읽고 실행 가능.
 *
 * @param {string} url
 * @returns {string}
 */
const toOriginUrl = (url) => {
  if (!url) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.toLowerCase();
  const isKakaoCdn = host === 'kakaocdn.net' || host.endsWith('.kakaocdn.net');
  if (!isKakaoCdn) return url;
  if (!parsed.pathname.startsWith('/thumb/')) return url;

  const fname = parsed.searchParams.get('fname');
  if (!fname) return url;

  let originUrl;
  try {
    originUrl = new URL(fname);
  } catch {
    return url;
  }
  if (originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') return url;
  return originUrl.toString();
};

const main = async () => {
  // kakaocdn thumb URL 인 모든 row 가 후보 (사이즈 무관).
  // SQL LIKE 로 1차 거르고 JS 에서 호스트 정확 매칭 한 번 더.
  const rows = await prisma.book.findMany({
    where: {
      coverUrl: { contains: 'kakaocdn.net/thumb/' },
    },
    select: { id: true, isbn: true, coverUrl: true },
  });

  console.log(`[backfill-covers] candidates: ${rows.length}`);

  let skipped = 0;
  const updates = [];
  for (const row of rows) {
    const next = toOriginUrl(row.coverUrl);
    if (next === row.coverUrl) {
      skipped += 1;
      continue;
    }
    updates.push({ id: row.id, isbn: row.isbn, before: row.coverUrl, after: next });
  }

  console.log(
    `[backfill-covers] to update: ${updates.length} (skipped non-kakaocdn or no-fname: ${skipped})`,
  );

  if (DRY) {
    for (const u of updates.slice(0, 5)) {
      console.log(`  - ${u.isbn}: ${u.before} → ${u.after}`);
    }
    console.log('[backfill-covers] DRY run — no writes.');
    await prisma.$disconnect();
    return;
  }

  let touched = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.book.update({
          where: { id: u.id },
          data: { coverUrl: u.after },
        }),
      ),
    );
    touched += chunk.length;
    console.log(`[backfill-covers] updated ${touched}/${updates.length}`);
  }

  console.log(`[backfill-covers] done. updated=${touched}`);
  await prisma.$disconnect();
};

main().catch(async (err) => {
  console.error('[backfill-covers] failed:', err);
  await prisma.$disconnect();
  // node:process exit code 만 세팅 — n/no-process-exit 회피. 메인 모듈 끝에서 자연 종료.
  process.exitCode = 1;
});
