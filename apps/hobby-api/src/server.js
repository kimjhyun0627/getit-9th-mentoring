/**
 * hobby-api 진입점 placeholder.
 *
 * 본 PR (#63 / issue #33) 은 DBA 작업 — Prisma 스키마/마이그레이션/seed 한정.
 * Express 앱·라우트·미들웨어는 후속 BE 이슈에서 추가 예정.
 *
 * 지금은 `pnpm --filter @getit/hobby-api dev` / `... start` 가 즉시 실패하지
 * 않도록 안내 로그만 출력하고 깨끗이 종료한다. 이렇게 두면 모노레포 전역
 * `pnpm dev` 같은 명령이 hobby-api 때문에 죽는 일도 막을 수 있다.
 */
console.log(
  '[hobby-api] server placeholder — Express 앱은 후속 BE 이슈에서 구현됩니다. ' +
    '현재는 prisma:* 스크립트 (generate / migrate / seed) 만 의미가 있습니다.',
);
