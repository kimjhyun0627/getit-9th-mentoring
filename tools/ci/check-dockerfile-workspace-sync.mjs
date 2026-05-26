#!/usr/bin/env node
// Dockerfile workspace COPY drift 가드.
//
// 배경: 2026-05-26 라이브 다운 incident.
//   PR #579 가 `@getit/env-validator` workspace 패키지를 추가하고
//   5 BE `package.json` 의 `dependencies` 에 박았는데, 5 BE Dockerfile 에
//   `COPY packages/env-validator/...` 라인이 누락 → `pnpm install --filter`
//   가 workspace dep resolve 실패 → 후속 `pnpm deploy --prod` 가 모든
//   transitive deps (dotenv, pino, express) 까지 prune → 5 BE 컨테이너
//   restart loop, 45 분 다운. PR #584 가 Dockerfile COPY 추가로 root fix.
//
// 이 스크립트는 그 사고 재발을 막는다:
// 각 앱의 `dependencies` 에 있는 모든 `@getit/*` workspace 패키지에 대해,
// 그 앱 Dockerfile 이 패키지 디렉토리를 (manifest + source 양쪽) COPY 하는지
// 확인. 누락 시 exit 1 + 명확한 메시지.
//
// 의존성: Node 20+ 표준 라이브러리만 사용. CI 에서 dep install 없이 실행 가능.
//
// CLI:
//   node tools/ci/check-dockerfile-workspace-sync.mjs           # default: repo root
//   node tools/ci/check-dockerfile-workspace-sync.mjs --root X  # 다른 root 검사 (테스트용)
//   node tools/ci/check-dockerfile-workspace-sync.mjs --json    # JSON 결과 출력
//
// Programmatic:
//   import { checkDockerfileWorkspaceSync } from './check-dockerfile-workspace-sync.mjs';
//   const result = await checkDockerfileWorkspaceSync({ root: '/path/to/repo' });
//   // → { ok: boolean, errors: [...], warnings: [...], apps: [...] }

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * JSON.parse 결과가 plain object 가 아닐 수도 있다 (null, 배열, 문자열, …).
 * package.json 으로서 의미 있는 값만 허용 — Gemini #593.
 */
function isPlainManifest(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

async function readManifest(manifestPath) {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!isPlainManifest(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function ensureDir(dir, label) {
  try {
    await stat(dir);
  } catch {
    throw new Error(
      `${label} 디렉토리 없음: ${dir} — --root 인자가 monorepo root 가리키는지 확인.`
    );
  }
}

/**
 * @param {{ root: string }} opts
 */
export async function collectWorkspacePackages({ root }) {
  const pkgsDir = path.join(root, 'packages');
  await ensureDir(pkgsDir, 'packages/');
  const entries = await readdir(pkgsDir, { withFileTypes: true });
  /** @type {Map<string, string>} pkg name → directory name */
  const nameToDir = new Map();
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifest = await readManifest(
      path.join(pkgsDir, e.name, 'package.json')
    );
    if (!manifest || !manifest.name) continue;
    nameToDir.set(manifest.name, e.name);
  }
  return nameToDir;
}

/**
 * @param {{ root: string }} opts
 */
export async function collectApps({ root }) {
  const appsDir = path.join(root, 'apps');
  await ensureDir(appsDir, 'apps/');
  const entries = await readdir(appsDir, { withFileTypes: true });
  /** @type {Array<{ dir: string, manifestPath: string, dockerfilePath: string, name: string, runtimeWorkspaceDeps: string[], allWorkspaceDeps: string[] }>} */
  const apps = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const appDir = path.join(appsDir, e.name);
    const manifestPath = path.join(appDir, 'package.json');
    const dockerfilePath = path.join(appDir, 'Dockerfile');
    const manifest = await readManifest(manifestPath);
    if (!manifest) continue;
    try {
      await stat(dockerfilePath);
    } catch {
      // Dockerfile 없는 앱은 스킵 (현재 모두 있긴 함).
      continue;
    }
    const filterWorkspace = (block) =>
      Object.entries(block ?? {})
        .filter(([, v]) => typeof v === 'string' && v.startsWith('workspace:'))
        .map(([k]) => k)
        .filter((k) => k.startsWith('@getit/'));
    const runtimeWorkspaceDeps = filterWorkspace(manifest.dependencies);
    const devWorkspaceDeps = filterWorkspace(manifest.devDependencies);
    apps.push({
      dir: e.name,
      manifestPath,
      dockerfilePath,
      name: manifest.name ?? e.name,
      runtimeWorkspaceDeps,
      // 중복 제거 union — extra-COPY warning 산정 시에만 사용.
      allWorkspaceDeps: [
        ...new Set([...runtimeWorkspaceDeps, ...devWorkspaceDeps]),
      ],
    });
  }
  return apps;
}

/**
 * Dockerfile 에서 `COPY packages/<dir>/package.json ...` 와 `COPY packages/<dir> ...`
 * 라인을 추출.
 *
 * 견고한 파서 (Gemini #593):
 *  - whitespace 로 split 한 뒤 첫 토큰이 `COPY` 인지 확인.
 *  - 이어지는 `--<flag>...` 옵션 토큰 (--chown, --chmod, --link 등) 은 스킵.
 *  - `--from=...` 가 있으면 build context 가 아니라 다른 stage 에서 가져오는
 *    것이므로 이 검사에서 제외.
 *  - 마지막 토큰은 destination, 그 앞의 모든 토큰은 source — 여러 source 가
 *    있는 멀티-src COPY 도 처리.
 *
 * @param {string} content Dockerfile 내용
 */
export function parseDockerfileCopies(content) {
  const lines = content.split('\n');
  /** @type {Set<string>} */
  const manifestCopies = new Set();
  /** @type {Set<string>} */
  const sourceCopies = new Set();

  for (const raw of lines) {
    // 주석 제거 → 토큰화.
    const stripped = raw.replace(/#.*$/, '').trim();
    if (!stripped) continue;
    const tokens = stripped.split(/\s+/);
    if (tokens[0] !== 'COPY') continue;
    // 옵션 토큰 (--flag / --flag=value) 처리.
    let i = 1;
    let fromStage = false;
    while (i < tokens.length && tokens[i].startsWith('--')) {
      if (tokens[i].startsWith('--from=')) fromStage = true;
      i += 1;
    }
    if (fromStage) continue; // 다른 stage 에서 복사 — 검사 대상 아님.
    // 남은 토큰: <src...> <dst>. 마지막 토큰 제외 = sources.
    const sources = tokens.slice(i, -1);
    if (sources.length === 0) continue;
    for (const src of sources) {
      const manifestMatch = src.match(/^packages\/([^/]+)\/package\.json$/);
      if (manifestMatch) {
        manifestCopies.add(manifestMatch[1]);
        continue;
      }
      const sourceMatch = src.match(/^packages\/([^/]+)\/?$/);
      if (sourceMatch) {
        sourceCopies.add(sourceMatch[1]);
      }
    }
  }
  return { manifestCopies, sourceCopies };
}

/**
 * 메인 검사.
 *
 * @param {{ root: string }} opts
 */
export async function checkDockerfileWorkspaceSync({ root }) {
  const nameToDir = await collectWorkspacePackages({ root });
  const apps = await collectApps({ root });

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  /** @type {Array<{ app: string, missingManifest: string[], missingSource: string[], extraCopies: string[] }>} */
  const perApp = [];

  for (const app of apps) {
    const dockerfile = await readFile(app.dockerfilePath, 'utf8');
    const { manifestCopies, sourceCopies } = parseDockerfileCopies(dockerfile);

    /** @type {string[]} */
    const missingManifest = [];
    /** @type {string[]} */
    const missingSource = [];

    for (const depName of app.runtimeWorkspaceDeps) {
      const depDir = nameToDir.get(depName);
      if (!depDir) {
        errors.push(
          `[${app.dir}] runtime workspace dep '${depName}' 가 packages/ 에 존재하지 않음 (이름 오타?).`
        );
        continue;
      }
      if (!manifestCopies.has(depDir)) {
        missingManifest.push(depDir);
      }
      if (!sourceCopies.has(depDir)) {
        missingSource.push(depDir);
      }
    }

    // 사용 안 하는 COPY (의존성에 없음) — warning.
    // collectApps 에서 이미 모은 union 사용 — manifest 재읽기 제거 (Gemini #593).
    const knownDirs = new Set(
      app.allWorkspaceDeps.map((n) => nameToDir.get(n)).filter(Boolean)
    );

    /** @type {string[]} */
    const extraCopies = [];
    for (const copied of new Set([...manifestCopies, ...sourceCopies])) {
      if (!knownDirs.has(copied)) {
        extraCopies.push(copied);
      }
    }

    perApp.push({
      app: app.dir,
      missingManifest,
      missingSource,
      extraCopies,
    });

    for (const dir of missingManifest) {
      errors.push(
        `[${app.dir}] Dockerfile 에 'COPY packages/${dir}/package.json packages/${dir}/package.json' 라인 누락 — runtime dep 인 '@getit/${dir}' 가 install 단계에서 resolve 불가.`
      );
    }
    for (const dir of missingSource) {
      errors.push(
        `[${app.dir}] Dockerfile 에 'COPY packages/${dir} packages/${dir}' 라인 누락 — runtime dep 인 '@getit/${dir}' source 가 image 에 포함 안 됨.`
      );
    }
    for (const dir of extraCopies) {
      warnings.push(
        `[${app.dir}] Dockerfile 에 'packages/${dir}' COPY 가 있지만 package.json 의 의존성에 없음 (사용 안 함).`
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    apps: perApp,
  };
}

function parseArgs(argv) {
  const args = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') {
      args.root = path.resolve(argv[++i] ?? '.');
    } else if (a === '--json') {
      args.json = true;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    }
  }
  return args;
}

const isMain = (() => {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'Usage: node tools/ci/check-dockerfile-workspace-sync.mjs [--root <path>] [--json]\n'
    );
    process.exit(0);
  }
  const result = await checkDockerfileWorkspaceSync({ root: args.root });
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    if (result.warnings.length > 0) {
      process.stdout.write('warnings:\n');
      for (const w of result.warnings) process.stdout.write(`  • ${w}\n`);
    }
    if (result.errors.length > 0) {
      process.stderr.write('\nDockerfile workspace COPY drift 감지:\n');
      for (const e of result.errors) process.stderr.write(`  ✗ ${e}\n`);
      process.stderr.write(
        '\n원인: 신규 workspace 패키지가 추가됐는데 의존하는 앱 Dockerfile 에 COPY 라인이 동기화 안 됨.\n' +
          '재발 방지: 2026-05-26 라이브 다운 (45min) 와 동일 패턴 — README 참조.\n' +
          '수정: 위 메시지의 COPY 라인을 manifest 단계 + source 단계 양쪽에 추가.\n'
      );
      process.exit(1);
    }
    process.stdout.write('Dockerfile workspace COPY drift 없음. (apps: ' + result.apps.length + ')\n');
  }
}
