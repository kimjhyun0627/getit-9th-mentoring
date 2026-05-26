# tools/ci

CI 보조 스크립트. dep zero — Node 20 표준 라이브러리만 사용해서 `pnpm install` 전이나 다른 환경에서도 돌 수 있다.

## 스크립트

### `check-dockerfile-workspace-sync.mjs`

`apps/*/package.json` 의 runtime `@getit/*` workspace 의존성과 `apps/*/Dockerfile` 의 `COPY packages/...` 라인이 일치하는지 검증.

```bash
node tools/ci/check-dockerfile-workspace-sync.mjs            # 검증
node tools/ci/check-dockerfile-workspace-sync.mjs --json     # 결과 JSON
node tools/ci/check-dockerfile-workspace-sync.mjs --root X   # 다른 root (테스트)
```

**왜 있나**: 2026-05-26 라이브 다운 (45min). PR #579 가 신규 `packages/env-validator/` 를 추가하고 5 BE `package.json` 에 dep 으로 박았는데 5 BE Dockerfile 에 `COPY packages/env-validator/...` 라인이 누락. → `pnpm install --filter` 가 workspace dep resolve 실패 → 후속 `pnpm deploy --prod` 가 dotenv/pino/express 까지 모두 prune → 5 BE 컨테이너 부팅 실패. PR #584 가 Dockerfile COPY 추가로 root fix.

**룰**: 앱 `dependencies` 의 `@getit/X: workspace:*` 마다, 그 앱 Dockerfile 에 두 줄이 있어야 한다 — `COPY packages/X/package.json packages/X/package.json` + `COPY packages/X packages/X`. `devDependencies` (예: `config-eslint`) 는 source COPY 강제 안 함.

**테스트**: `node --test tools/ci/check-dockerfile-workspace-sync.test.mjs` — fixture 기반 12 케이스 (실제 repo state 포함).

**CI 통합**: `.github/workflows/ci.yml` 의 `format / lint / test / build` job 에 step 으로 들어가있음. 가드 + self-test 둘 다 돌린다.
