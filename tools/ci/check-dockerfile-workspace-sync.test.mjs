// Unit tests for check-dockerfile-workspace-sync.mjs.
// Runner: `node --test tools/ci/check-dockerfile-workspace-sync.test.mjs`.
// 의존성 zero — node:test 표준 라이브러리.
//
// Fixture 전략: 각 테스트가 임시 디렉토리에 mock repo (packages/ + apps/) 만든 뒤
// guard 함수 호출. PR #579→#584 incident 시나리오 + 정상/extra-copy/오타 케이스 커버.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  checkDockerfileWorkspaceSync,
  parseDockerfileCopies,
} from './check-dockerfile-workspace-sync.mjs';

async function makeFixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'docker-drift-'));
  await mkdir(path.join(root, 'packages'), { recursive: true });
  await mkdir(path.join(root, 'apps'), { recursive: true });
  return root;
}

async function writePkg(root, dir, name, opts = {}) {
  const isApp = opts.app === true;
  const baseDir = path.join(root, isApp ? 'apps' : 'packages', dir);
  await mkdir(baseDir, { recursive: true });
  await writeFile(
    path.join(baseDir, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '0.0.0',
        ...(opts.dependencies ? { dependencies: opts.dependencies } : {}),
        ...(opts.devDependencies ? { devDependencies: opts.devDependencies } : {}),
      },
      null,
      2
    )
  );
  if (opts.dockerfile != null) {
    await writeFile(path.join(baseDir, 'Dockerfile'), opts.dockerfile);
  }
}

test('parseDockerfileCopies: manifest + source 매칭', () => {
  const content = `
FROM node:20-alpine
COPY pnpm-lock.yaml ./
COPY packages/auth-utils/package.json packages/auth-utils/package.json
COPY packages/schemas/package.json    packages/schemas/package.json
COPY packages/auth-utils packages/auth-utils
COPY packages/schemas    packages/schemas
COPY --from=builder /out /app
`;
  const { manifestCopies, sourceCopies } = parseDockerfileCopies(content);
  assert.deepEqual([...manifestCopies].sort(), ['auth-utils', 'schemas']);
  assert.deepEqual([...sourceCopies].sort(), ['auth-utils', 'schemas']);
});

test('parseDockerfileCopies: --from= COPY 는 무시', () => {
  const content = `COPY --from=builder /repo/dist /out\nCOPY --from=builder --chown=app:app /out /app\n`;
  const { manifestCopies, sourceCopies } = parseDockerfileCopies(content);
  assert.equal(manifestCopies.size, 0);
  assert.equal(sourceCopies.size, 0);
});

test('parseDockerfileCopies: --chown 플래그 허용', () => {
  const content = `COPY --chown=app:app packages/foo packages/foo\n`;
  const { sourceCopies } = parseDockerfileCopies(content);
  assert.deepEqual([...sourceCopies], ['foo']);
});

test('parseDockerfileCopies: --chmod / --link 등 임의 플래그 조합 허용 (Gemini #593)', () => {
  const content = [
    `COPY --link --chmod=0644 packages/foo/package.json packages/foo/package.json`,
    `COPY --chown=app:app --link packages/bar packages/bar`,
  ].join('\n');
  const { manifestCopies, sourceCopies } = parseDockerfileCopies(content);
  assert.deepEqual([...manifestCopies], ['foo']);
  assert.deepEqual([...sourceCopies], ['bar']);
});

test('parseDockerfileCopies: 멀티 src COPY — 마지막 토큰만 destination (Gemini #593)', () => {
  // `COPY src1 src2 dest/` 처럼 한 줄에 여러 source 가 있는 경우.
  const content = `COPY packages/foo packages/bar /out/\n`;
  const { sourceCopies } = parseDockerfileCopies(content);
  assert.deepEqual([...sourceCopies].sort(), ['bar', 'foo']);
});

test('parseDockerfileCopies: 빈 줄 / 들여쓰기 / 트레일링 공백 무관', () => {
  const content = `
    COPY packages/foo packages/foo
\tCOPY packages/bar packages/bar
`;
  const { sourceCopies } = parseDockerfileCopies(content);
  assert.deepEqual([...sourceCopies].sort(), ['bar', 'foo']);
});

test('drift 없음 → ok=true, errors 비어있음', async () => {
  const root = await makeFixtureRoot();
  try {
    await writePkg(root, 'auth-utils', '@getit/auth-utils');
    await writePkg(root, 'schemas', '@getit/schemas');
    await writePkg(root, 'env-validator', '@getit/env-validator');
    await writePkg(root, 'auth-api', '@getit/auth-api', {
      app: true,
      dependencies: {
        '@getit/auth-utils': 'workspace:*',
        '@getit/schemas': 'workspace:*',
        '@getit/env-validator': 'workspace:*',
      },
      dockerfile: [
        'FROM node:20-alpine',
        'COPY packages/auth-utils/package.json    packages/auth-utils/package.json',
        'COPY packages/schemas/package.json       packages/schemas/package.json',
        'COPY packages/env-validator/package.json packages/env-validator/package.json',
        'COPY packages/auth-utils  packages/auth-utils',
        'COPY packages/schemas     packages/schemas',
        'COPY packages/env-validator packages/env-validator',
        'COPY apps/auth-api        apps/auth-api',
      ].join('\n'),
    });
    const result = await checkDockerfileWorkspaceSync({ root });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
    assert.deepEqual(result.errors, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('incident sim (PR #579 pre-#584): runtime dep 박았는데 Dockerfile COPY 누락 → exit 1', async () => {
  const root = await makeFixtureRoot();
  try {
    await writePkg(root, 'auth-utils', '@getit/auth-utils');
    await writePkg(root, 'env-validator', '@getit/env-validator');
    await writePkg(root, 'auth-api', '@getit/auth-api', {
      app: true,
      dependencies: {
        '@getit/auth-utils': 'workspace:*',
        '@getit/env-validator': 'workspace:*',
      },
      // PR #579 가 deps 만 추가, Dockerfile 은 안 건드림 → env-validator COPY 누락.
      dockerfile: [
        'FROM node:20-alpine',
        'COPY packages/auth-utils/package.json packages/auth-utils/package.json',
        'COPY packages/auth-utils packages/auth-utils',
      ].join('\n'),
    });
    const result = await checkDockerfileWorkspaceSync({ root });
    assert.equal(result.ok, false);
    // 두 줄: manifest 누락 + source 누락.
    assert.equal(
      result.errors.filter((e) => e.includes('env-validator')).length,
      2,
      'env-validator 관련 에러 두 줄 (manifest + source) 나와야 함'
    );
    // 메시지에 앱 이름 + 패키지 이름 + 자기 식별 가능한 hint 포함.
    assert.ok(result.errors.some((e) => e.includes('auth-api')));
    assert.ok(result.errors.some((e) => e.includes('@getit/env-validator')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source COPY 만 누락 → exit 1', async () => {
  const root = await makeFixtureRoot();
  try {
    await writePkg(root, 'shared', '@getit/shared');
    await writePkg(root, 'web', '@getit/web', {
      app: true,
      dependencies: { '@getit/shared': 'workspace:*' },
      dockerfile: [
        'FROM node:20-alpine',
        'COPY packages/shared/package.json packages/shared/package.json',
        // source COPY 누락.
      ].join('\n'),
    });
    const result = await checkDockerfileWorkspaceSync({ root });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (e) => e.includes('source') && e.includes('shared')
      ),
      'source 누락 에러 메시지 있어야 함'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('devDependencies 워크스페이스 패키지는 source COPY 강제 안 함', async () => {
  const root = await makeFixtureRoot();
  try {
    await writePkg(root, 'config-eslint', '@getit/config-eslint');
    await writePkg(root, 'api', '@getit/api', {
      app: true,
      devDependencies: { '@getit/config-eslint': 'workspace:*' },
      dockerfile: [
        'FROM node:20-alpine',
        // manifest 만 있고 source 없어도 OK (devDep).
        'COPY packages/config-eslint/package.json packages/config-eslint/package.json',
      ].join('\n'),
    });
    const result = await checkDockerfileWorkspaceSync({ root });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('의존성 없는 패키지 COPY → warning (fail 안 함)', async () => {
  const root = await makeFixtureRoot();
  try {
    await writePkg(root, 'schemas', '@getit/schemas');
    await writePkg(root, 'auth-utils', '@getit/auth-utils');
    await writePkg(root, 'web', '@getit/web', {
      app: true,
      dependencies: { '@getit/auth-utils': 'workspace:*' },
      // schemas 를 의존하지도 않는데 COPY 함 → warn.
      dockerfile: [
        'FROM node:20-alpine',
        'COPY packages/auth-utils/package.json packages/auth-utils/package.json',
        'COPY packages/schemas/package.json    packages/schemas/package.json',
        'COPY packages/auth-utils packages/auth-utils',
        'COPY packages/schemas    packages/schemas',
      ].join('\n'),
    });
    const result = await checkDockerfileWorkspaceSync({ root });
    assert.equal(result.ok, true);
    assert.ok(
      result.warnings.some((w) => w.includes('schemas')),
      'schemas extra COPY warning 있어야 함'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('packages/ 에 존재하지 않는 dep → 에러', async () => {
  const root = await makeFixtureRoot();
  try {
    await writePkg(root, 'api', '@getit/api', {
      app: true,
      dependencies: { '@getit/ghost': 'workspace:*' },
      dockerfile: 'FROM node:20-alpine\n',
    });
    const result = await checkDockerfileWorkspaceSync({ root });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.includes('ghost') && e.includes('오타')),
      '존재하지 않는 패키지 에러 메시지'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Dockerfile 없는 앱은 스킵 (pure JS 패키지 등)', async () => {
  const root = await makeFixtureRoot();
  try {
    await writePkg(root, 'auth-utils', '@getit/auth-utils');
    await writePkg(root, 'no-docker', '@getit/no-docker', {
      app: true,
      dependencies: { '@getit/auth-utils': 'workspace:*' },
      // dockerfile 없음.
    });
    const result = await checkDockerfileWorkspaceSync({ root });
    assert.equal(result.ok, true);
    assert.equal(result.apps.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('package.json 이 null/array/empty 여도 크래시 안 함 (Gemini #593 defensive)', async () => {
  const root = await makeFixtureRoot();
  try {
    // 정상 패키지 + manifest 가 null 인 비정상 패키지 공존.
    await writePkg(root, 'auth-utils', '@getit/auth-utils');
    await mkdir(path.join(root, 'packages', 'broken-null'), { recursive: true });
    await writeFile(
      path.join(root, 'packages', 'broken-null', 'package.json'),
      'null'
    );
    await mkdir(path.join(root, 'packages', 'broken-array'), { recursive: true });
    await writeFile(
      path.join(root, 'packages', 'broken-array', 'package.json'),
      '[]'
    );
    await mkdir(path.join(root, 'packages', 'broken-empty'), { recursive: true });
    await writeFile(path.join(root, 'packages', 'broken-empty', 'package.json'), '');
    await writePkg(root, 'web', '@getit/web', {
      app: true,
      dependencies: { '@getit/auth-utils': 'workspace:*' },
      dockerfile: [
        'COPY packages/auth-utils/package.json packages/auth-utils/package.json',
        'COPY packages/auth-utils packages/auth-utils',
      ].join('\n'),
    });
    // 크래시 없이 정상 동작해야 함. 깨진 패키지는 무시.
    const result = await checkDockerfileWorkspaceSync({ root });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('non-workspace `@getit/*` (e.g. published) 는 무시 — workspace: prefix 만 봄', async () => {
  const root = await makeFixtureRoot();
  try {
    await writePkg(root, 'api', '@getit/api', {
      app: true,
      dependencies: { '@getit/some-published': '^1.2.3' },
      dockerfile: 'FROM node:20-alpine\n',
    });
    const result = await checkDockerfileWorkspaceSync({ root });
    assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('실제 repo state (worktree root) — drift 없음', async () => {
  // 이 테스트 파일이 tools/ci/ 안에 있으므로 두 단계 위가 repo root.
  const here = path.dirname(new URL(import.meta.url).pathname);
  const root = path.resolve(here, '..', '..');
  const result = await checkDockerfileWorkspaceSync({ root });
  // 현재 main 은 PR #584 머지 후라 drift 없어야 함.
  assert.equal(
    result.ok,
    true,
    'real repo drift 발견됨:\n' + result.errors.join('\n')
  );
});
