/**
 * check-vite-build-args 가드 테스트.
 *
 * 인메모리 fs 어댑터로 fixture 시나리오를 구성해서 `analyzeDrift` 의 분류
 * 로직 (MISSING / WARN / 정상) 을 검증한다.
 *
 * 회귀 케이스:
 *   1. drift 없음 — exit 0, errors=[]
 *   2. src 에 새 VITE_NEW_X 추가, Dockerfile ARG 누락 — exit 1, errors 가
 *      어느 web 어느 VITE_ 가 누락됐는지 명시.
 *   3. Dockerfile ARG 있는데 deploy.yml build-args 누락 — exit 1, errors 명시.
 *   4. Dockerfile / deploy 에 unused ARG — exit 0, warnings 만.
 *   5. 실제 #586 이전 (hobby-web 사고) 시나리오 — exit 1, hobby-web 메시지 포함.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeDrift,
  collectDeployViteBuildArgs,
  collectDockerfileViteArgs,
  collectSrcViteVars,
  formatReport,
} from './lib.mjs';

// ─────────────────── 인메모리 fs 어댑터 ───────────────────

/**
 * @param {Record<string, string>} files  경로 → 내용 (디렉토리는 path prefix 추론)
 */
function memFs(files) {
  const paths = Object.keys(files);
  return {
    exists: (p) => {
      if (files[p] !== undefined) return true;
      // 디렉토리 존재 = prefix 매치
      const prefix = p.endsWith('/') ? p : p + '/';
      return paths.some((k) => k.startsWith(prefix));
    },
    readFile: (p) => {
      if (files[p] === undefined) throw new Error(`ENOENT memFs: ${p}`);
      return files[p];
    },
    readdir: (p) => {
      const prefix = p.endsWith('/') ? p : p + '/';
      const direct = new Map(); // name → isDir
      for (const k of paths) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        const name = rest.split('/')[0];
        const isDir = rest.includes('/');
        if (!direct.has(name) || isDir) direct.set(name, isDir);
      }
      return [...direct.entries()].map(([name, isDir]) => ({
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir,
      }));
    },
  };
}

const repoRoot = '/repo';

/** 6 web 통일 ARG set (PR #586 hotfix 와 동일). */
const FULL_DOCKERFILE = `FROM node:20-alpine AS builder
ARG VITE_AUTH_API_URL=https://auth.get-it.cloud/api
ARG VITE_AUTH_URL=https://auth.get-it.cloud
ARG VITE_AUTH_ORIGIN=https://auth.get-it.cloud
ARG VITE_API_URL=/api
ARG VITE_NICKNAME_ONBOARDING_ENFORCED=
ENV VITE_AUTH_API_URL=\${VITE_AUTH_API_URL}
RUN pnpm build
`;

const FULL_DEPLOY = `name: Deploy
jobs:
  build:
    steps:
      - name: Build
        with:
          build-args: |
            VITE_AUTH_API_URL=https://auth.get-it.cloud/api
            VITE_AUTH_URL=https://auth.get-it.cloud
            VITE_AUTH_ORIGIN=https://auth.get-it.cloud
            VITE_API_URL=/api
            VITE_NICKNAME_ONBOARDING_ENFORCED=
`;

/** 모든 VITE_*5 를 다 쓰는 src 파일. */
const FULL_SRC = `
const a = import.meta.env?.VITE_AUTH_API_URL;
const b = import.meta.env?.VITE_AUTH_URL;
const c = import.meta.env.VITE_AUTH_ORIGIN;
const d = import.meta.env?.VITE_API_URL;
const e = import.meta.env?.VITE_NICKNAME_ONBOARDING_ENFORCED;
`;

const WEB_APPS = ['hobby-web'];

function baseFiles({
  srcText = FULL_SRC,
  dockerfileText = FULL_DOCKERFILE,
  deployText = FULL_DEPLOY,
} = {}) {
  return {
    '/repo/apps/hobby-web/src/main.js': srcText,
    '/repo/apps/hobby-web/Dockerfile': dockerfileText,
    '/repo/.github/workflows/deploy.yml': deployText,
  };
}

// ─────────────────── 케이스 1: drift 없음 ───────────────────
describe('analyzeDrift — drift 없음', () => {
  it('exit 0 (errors 0)', () => {
    const fs = memFs(baseFiles());
    const r = analyzeDrift({
      repoRoot,
      webApps: WEB_APPS,
      deployYmlPath: '.github/workflows/deploy.yml',
      fs,
    });
    assert.equal(r.errors.length, 0, formatReport(r));
    assert.equal(r.warnings.length, 0, formatReport(r));
  });
});

// ─────────────────── 케이스 2: src 에 새 VITE_NEW_X, Dockerfile 누락 ───────────────────
describe('analyzeDrift — src 가 새 VITE_NEW_X 도입, Dockerfile ARG 누락', () => {
  it('exit 1 — 어느 web 어느 VITE_ 가 누락됐는지 메시지에 포함', () => {
    const srcWithNew = FULL_SRC + '\nconst z = import.meta.env?.VITE_NEW_FEATURE_FLAG;';
    const fs = memFs(baseFiles({ srcText: srcWithNew }));
    const r = analyzeDrift({
      repoRoot,
      webApps: WEB_APPS,
      deployYmlPath: '.github/workflows/deploy.yml',
      fs,
    });
    assert.ok(r.errors.length > 0, 'errors 가 있어야 함');
    const joined = r.errors.join('\n');
    assert.match(joined, /hobby-web/);
    assert.match(joined, /VITE_NEW_FEATURE_FLAG/);
    assert.match(joined, /Dockerfile/);
  });
});

// ─────────────────── 케이스 3: Dockerfile ARG 있는데 deploy.yml 누락 ───────────────────
describe('analyzeDrift — Dockerfile ARG 있는데 deploy.yml build-args 누락', () => {
  it('exit 1 — deploy.yml 누락 메시지', () => {
    // deploy.yml 에서 VITE_AUTH_API_URL 라인 제거
    const partialDeploy = FULL_DEPLOY.replace(/^.*VITE_AUTH_API_URL=.*$\n/m, '');
    const fs = memFs(baseFiles({ deployText: partialDeploy }));
    const r = analyzeDrift({
      repoRoot,
      webApps: WEB_APPS,
      deployYmlPath: '.github/workflows/deploy.yml',
      fs,
    });
    assert.ok(r.errors.length > 0);
    const joined = r.errors.join('\n');
    assert.match(joined, /deploy\.yml/);
    assert.match(joined, /VITE_AUTH_API_URL/);
    assert.ok(
      r.missingInDeploy.some((m) => m.app === 'hobby-web' && m.name === 'VITE_AUTH_API_URL'),
      'missingInDeploy 에 hobby-web/VITE_AUTH_API_URL 가 있어야 함',
    );
  });
});

// ─────────────────── 케이스 4: unused ARG → warn only ───────────────────
describe('analyzeDrift — Dockerfile 에 unused ARG (src 안 쓰는)', () => {
  it('exit 0 — warnings 만, errors 0', () => {
    // src 가 1개만 쓰는데 Dockerfile 은 5개 ARG (현재 landing 같은 상황)
    const minimalSrc = 'const a = import.meta.env.VITE_AUTH_ORIGIN;';
    const fs = memFs(baseFiles({ srcText: minimalSrc }));
    const r = analyzeDrift({
      repoRoot,
      webApps: WEB_APPS,
      deployYmlPath: '.github/workflows/deploy.yml',
      fs,
    });
    assert.equal(r.errors.length, 0, formatReport(r));
    assert.ok(r.warnings.length > 0, 'warnings 가 있어야 함 (unused ARG 들)');
    assert.match(r.warnings.join('\n'), /VITE_AUTH_API_URL/);
  });
});

// ─────────────────── 케이스 5: deploy.yml 에 unused → warn only ───────────────────
describe('analyzeDrift — deploy.yml 에 어떤 Dockerfile 도 안 쓰는 VITE_', () => {
  it('exit 0 — warnings 만', () => {
    const fatDeploy = FULL_DEPLOY.trimEnd() + '\n            VITE_GHOST_VAR=ghost\n';
    const fs = memFs(baseFiles({ deployText: fatDeploy }));
    const r = analyzeDrift({
      repoRoot,
      webApps: WEB_APPS,
      deployYmlPath: '.github/workflows/deploy.yml',
      fs,
    });
    assert.equal(r.errors.length, 0, formatReport(r));
    assert.ok(r.warnings.some((w) => /VITE_GHOST_VAR/.test(w)));
  });
});

// ─────────────────── 케이스 6: #586 이전 hobby-web 사고 시나리오 ───────────────────
describe('analyzeDrift — incident #585 (PR #586 이전 상태)', () => {
  it('exit 1 — hobby-web 의 VITE_AUTH_API_URL 가 Dockerfile 에 없다고 박혀야 함', () => {
    const preIncidentDockerfile = `FROM node:20-alpine AS builder
COPY apps/hobby-web apps/hobby-web
RUN pnpm build
`;
    const preIncidentDeploy = `name: Deploy
jobs:
  build:
    steps:
      - name: Build
        with:
          tags: foo
`;
    const fs = memFs(
      baseFiles({ dockerfileText: preIncidentDockerfile, deployText: preIncidentDeploy }),
    );
    const r = analyzeDrift({
      repoRoot,
      webApps: WEB_APPS,
      deployYmlPath: '.github/workflows/deploy.yml',
      fs,
    });
    assert.ok(r.errors.length > 0);
    const joined = r.errors.join('\n');
    assert.match(joined, /hobby-web/);
    assert.match(joined, /VITE_AUTH_API_URL/);
    assert.match(joined, /Dockerfile/);
  });
});

// ─────────────────── 케이스 7: src walker — node_modules / dist 스킵 ───────────────────
describe('collectSrcViteVars', () => {
  it('node_modules / dist / .turbo 안의 VITE_ 사용은 무시', () => {
    const fs = memFs({
      '/app/src/main.js': 'import.meta.env.VITE_REAL',
      '/app/src/node_modules/pkg/x.js': 'import.meta.env.VITE_FAKE',
      '/app/src/dist/y.js': 'import.meta.env.VITE_FAKE2',
    });
    const got = collectSrcViteVars('/app/src', fs);
    assert.deepEqual([...got].sort(), ['VITE_REAL']);
  });

  it('.jsx / .tsx / .mjs / .cjs 도 스캔', () => {
    const fs = memFs({
      '/app/a.jsx': 'import.meta.env.VITE_A',
      '/app/b.tsx': 'import.meta.env.VITE_B',
      '/app/c.mjs': 'import.meta.env.VITE_C',
      '/app/d.cjs': 'import.meta.env.VITE_D',
      '/app/e.ts': 'import.meta.env.VITE_E',
    });
    const got = collectSrcViteVars('/app', fs);
    assert.deepEqual([...got].sort(), ['VITE_A', 'VITE_B', 'VITE_C', 'VITE_D', 'VITE_E']);
  });

  it('`?.` 옵셔널 체인 + 직접 액세스 둘 다 매칭', () => {
    const fs = memFs({
      '/app/x.js': 'const a = import.meta.env?.VITE_OPT; const b = import.meta.env.VITE_DIRECT;',
    });
    const got = collectSrcViteVars('/app', fs);
    assert.deepEqual([...got].sort(), ['VITE_DIRECT', 'VITE_OPT']);
  });
});

// ─────────────────── 케이스 R1: Dockerfile ARG 인라인 주석 허용 (Gemini #596) ───────────────────
describe('collectDockerfileViteArgs — 인라인 주석', () => {
  it('`ARG VITE_FOO # 주석` 도 매칭', () => {
    const text = `ARG VITE_FOO  # 인라인 주석
ARG VITE_BAR=default  # 디폴트 + 주석
ARG VITE_BAZ`;
    const got = collectDockerfileViteArgs(text);
    assert.deepEqual([...got].sort(), ['VITE_BAR', 'VITE_BAZ', 'VITE_FOO']);
  });
});

// ─────────────────── 케이스 R2: src walker `.` 무한재귀 방어 (Gemini #596) ───────────────────
describe('collectSrcViteVars — `.` 이름 엔트리는 스킵', () => {
  it('`entry.name === "."` 이어도 무한 재귀하지 않음', () => {
    // memFs 는 자연스럽게 . 을 생성 안 하지만 방어적 readdir 시뮬레이션.
    const fs = {
      exists: () => true,
      readFile: () => '',
      readdir: (p) => {
        if (p === '/app') {
          return [
            { name: '.', isDirectory: () => true, isFile: () => false },
            { name: 'real.js', isDirectory: () => false, isFile: () => true },
          ];
        }
        // `.` 로 들어왔다면 무한 재귀 트리거. 절대 호출되면 안 됨.
        throw new Error('regression: walker recursed into "." entry');
      },
    };
    fs.readFile = () => 'import.meta.env.VITE_X';
    const got = collectSrcViteVars('/app', fs);
    assert.deepEqual([...got], ['VITE_X']);
  });
});

// ─────────────────── 케이스 R3: deploy.yml build-args 블록 범위 (CodeRabbit #596) ───────────────────
describe('collectDeployViteBuildArgs — build-args 블록 안만 본다', () => {
  it('build-args 밖의 `VITE_FOO=...` 라인은 무시', () => {
    const text = `jobs:
  build:
    steps:
      - name: Build
        env:
          VITE_LEAKED=should-not-count
        with:
          build-args: |
            VITE_REAL_A=https://x
            VITE_REAL_B=
      - name: Other
        run: |
          export VITE_SHELL_VAR=nope
`;
    const got = collectDeployViteBuildArgs(text);
    assert.deepEqual([...got].sort(), ['VITE_REAL_A', 'VITE_REAL_B']);
  });

  it('여러 build-args 블록도 누적 수집', () => {
    const text = `steps:
  - with:
      build-args: |
        VITE_A=1
  - with:
      build-args: |
        VITE_B=2
`;
    const got = collectDeployViteBuildArgs(text);
    assert.deepEqual([...got].sort(), ['VITE_A', 'VITE_B']);
  });

  it('`build-args:` 없는 파일에선 빈 set', () => {
    const text = `jobs:
  x:
    steps:
      - run: VITE_NOT_IN_BLOCK=foo
`;
    const got = collectDeployViteBuildArgs(text);
    assert.equal(got.size, 0);
  });
});

// ─────────────────── 케이스 8: 여러 web 동시 검사 ───────────────────
describe('analyzeDrift — 여러 web 동시', () => {
  it('한 web 만 drift 있을 때 그 web 만 메시지에 박힘', () => {
    const fs = memFs({
      '/repo/apps/hobby-web/src/main.js': 'import.meta.env.VITE_AUTH_API_URL',
      '/repo/apps/hobby-web/Dockerfile': FULL_DOCKERFILE, // OK
      '/repo/apps/landing/src/main.js': 'import.meta.env.VITE_MISSING_VAR',
      '/repo/apps/landing/Dockerfile': FULL_DOCKERFILE, // VITE_MISSING_VAR 없음
      '/repo/.github/workflows/deploy.yml': FULL_DEPLOY,
    });
    const r = analyzeDrift({
      repoRoot,
      webApps: ['hobby-web', 'landing'],
      deployYmlPath: '.github/workflows/deploy.yml',
      fs,
    });
    const errs = r.errors.join('\n');
    assert.match(errs, /landing/);
    assert.match(errs, /VITE_MISSING_VAR/);
    // hobby-web 은 BLOCK 메시지에 안 박혀야 함 (drift 없으니까)
    assert.ok(!/hobby-web.*BLOCK/.test(errs), `hobby-web 에 BLOCK 없어야 함:\n${errs}`);
  });
});
