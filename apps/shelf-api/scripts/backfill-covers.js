#!/usr/bin/env node
/**
 * #474 — 기존 캐시된 Book.coverUrl 중 Kakao thumbnail 의
 * 저화질 사이즈 토큰 (`R120x174` 등) 을 hi-res (`R480x696`) 로 일괄 백필.
 *
 * 배경:
 * - PR #366 (upscaleKakaoThumbnail) 머지 전 캐시된 row 는 24h TTL 만료까지
 *   저화질 URL 그대로 유지. 그동안 사용자는 흐릿한 표지를 본다.
 * - 이 스크립트는 일회성. CDN 호스트가 kakaocdn.net (또는 그 서브도메인) 인
 *   row 만 손대고, `/thumb/[A-Z]\d+x\d+` 토큰을 `R480x696` 으로 치환한다.
 * - 외부 URL 에 우연히 `kakaocdn.net/thumb/...` 가 substring 으로 들어간 경우는
 *   URL hostname 정확 매칭으로 걸러진다 (kakao.js upscale 과 동일 로직).
 *
 * 실행 (운영 VM):
 *   cd /opt/getit && docker compose exec shelf-api node scripts/backfill-covers.js
 *
 * Dry-run (실제 update 안 함, 영향 카운트만):
 *   node scripts/backfill-covers.js --dry
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');
const BATCH = 200;

/**
 * kakao.js 의 upscaleKakaoThumbnail 과 동일 정책 (호스트 정확 매칭 + path prefix).
 * 라이브러리 함수 재사용 안 하는 이유: 운영 VM 에서 단발성 실행이라
 * import 경로 의존 최소화 (이 파일 단독으로 읽고 실행 가능).
 *
 * @param {string} url
 * @returns {string}
 */
const upscale = (url) => {
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
  const next = parsed.pathname.replace(/^\/thumb\/[A-Z]\d+x\d+/i, '/thumb/R480x696');
  if (next === parsed.pathname) return url;
  parsed.pathname = next;
  return parsed.toString();
};

const main = async () => {
  // kakaocdn 호스트 + thumb 패스 + 이미 R480x696 이 아닌 row 만 후보.
  // SQL LIKE 로 1차 거르고 (인덱스 없으니 풀스캔이지만 Book row 수 적음),
  // JS 에서 URL parse 로 호스트 정확 매칭 한 번 더.
  const rows = await prisma.book.findMany({
    where: {
      AND: [
        { coverUrl: { contains: 'kakaocdn.net/thumb/' } },
        { NOT: { coverUrl: { contains: '/thumb/R480x696' } } },
      ],
    },
    select: { id: true, isbn: true, coverUrl: true },
  });

  console.log(`[backfill-covers] candidates: ${rows.length}`);

  let touched = 0;
  let skipped = 0;
  const updates = [];
  for (const row of rows) {
    const next = upscale(row.coverUrl);
    if (next === row.coverUrl) {
      skipped += 1;
      continue;
    }
    updates.push({ id: row.id, isbn: row.isbn, before: row.coverUrl, after: next });
  }

  console.log(
    `[backfill-covers] to update: ${updates.length} (skipped non-kakaocdn or already hi-res: ${skipped})`,
  );

  if (DRY) {
    for (const u of updates.slice(0, 5)) {
      console.log(`  - ${u.isbn}: ${u.before} → ${u.after}`);
    }
    console.log('[backfill-covers] DRY run — no writes.');
    await prisma.$disconnect();
    return;
  }

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
