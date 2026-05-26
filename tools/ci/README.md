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

### `check-vite-build-args.mjs`

6 web (landing / auth-web / hobby-web / shelf-web / letter-web / board-web) 의 Vite 빌드 타임 env 가 세 곳에 동기화돼 있는지 검사한다:

1. `apps/<web>/src/**/*.{js,jsx,ts,tsx,mjs,cjs}` — `import.meta.env.VITE_*` 사용
2. `apps/<web>/Dockerfile` — `ARG VITE_*` 선언
3. `.github/workflows/deploy.yml` — `docker/build-push-action` 의 `build-args`

```bash
node tools/ci/check-vite-build-args.mjs            # repo root 에서
node tools/ci/check-vite-build-args.mjs --root .   # 명시
```

검증:

- src 에서 쓰는 `VITE_*` 가 그 web Dockerfile 에 `ARG VITE_*` 로 없으면 **BLOCK**. Vite 빌드 시 env 가 주입 안 돼 fallback 으로 떨어진다 (incident #585 패턴).
- Dockerfile 에 선언된 `ARG VITE_*` 가 deploy.yml `build-args` 에 없으면 **BLOCK**. prod 빌드 시 override 안 됨 → ARG default 만 박힘.
- 반대 방향 (Dockerfile/deploy 에만 있는 unused VITE\_\*) 은 **WARN** (비차단).

**왜 있나**: incident #585 (2026-05-26 라이브, hotfix PR #586). `hobby-web` 학번 마이그레이션 모달의 PATCH `/me/student-id` 가 404. 원인은 `import.meta.env?.VITE_AUTH_API_URL ?? '/api'` 의 `??` fallback. 6 web Dockerfile + deploy.yml 어디에도 `VITE_AUTH_API_URL` 가 build-arg 로 전달 안 돼서 fallback `/api` 가 번들에 박힘 → 같은 origin (hobby.get-it.cloud) 으로 PATCH → auth-api 가 아닌 hobby-api 가 받음 → 404. 이 가드는 같은 drift 패턴이 새 `VITE_*` env 도입 때 또 발생하는 걸 막는다.

**새 `VITE_*` env 추가 시 체크리스트**:

> **주의**: CI 가드는 1 / 2 / 4 (src / ARG / build-args) 만 자동 검증한다.
> 3번 `ENV VITE_*` 는 Vite 가 `process.env` 로 읽어 번들에 박는 데 필수지만
> 가드 범위 밖이므로 **수동 확인** 필요. (관습상 6 web Dockerfile 이 ARG 와
> 같은 블록에 ENV 도 박는 패턴이라 grep 한 번으로 검증 가능.)

1. `apps/<web>/src/**/*.js` — 사용 지점 (도입 시작)
2. `apps/<web>/Dockerfile` `ARG VITE_*` — 반드시 같이 (prod default 박기 권장)
3. `apps/<web>/Dockerfile` `ENV VITE_*` — 반드시 같이 (Vite 가 process.env 로 읽어야 번들에 박힘) — **수동**
4. `.github/workflows/deploy.yml` `build-args` — 반드시 같이 (prod override 필요 시)

**테스트**: `node --test tools/ci/check-vite-build-args.test.mjs` — fixture (인메모리 fs 어댑터) 기반, 15 케이스 (incident #585 회귀 + 봇 리뷰 회귀 포함).

**CI 통합**: `.github/workflows/ci.yml` 의 `format / lint / test / build` job 에 step 으로. 가드 + self-test 둘 다 돌린다.
