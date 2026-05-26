/**
 * VITE_* build args drift 가드 — pure analysis library.
 *
 * Incident (PR #586, 2026-05-26): hobby-web 학번 마이그레이션 모달 PATCH 가
 * 404. `apps/hobby-web/src/lib/api.core.js` 의 `import.meta.env?.VITE_AUTH_API_URL`
 * 가 6 web Dockerfile + deploy.yml build-args 어디에도 ARG 로 선언 안 돼서
 * Vite 빌드 시 fallback `/api` 가 번들에 박힘 → 같은 origin (hobby.get-it.cloud)
 * 으로 PATCH → 404.
 *
 * 이 모듈은 3-way 정합성을 검사한다:
 *   1. 각 web 의 src 가 사용하는 VITE_* set ⊆ 그 web Dockerfile 의 ARG VITE_* set
 *   2. 모든 web Dockerfile ARG 합집합 ⊆ deploy.yml build-args 의 VITE_* set
 *
 * Pure: 모든 입력은 파일 시스템 어댑터(`fs`)로 추상화. CLI 와 테스트가 각각
 * 실제 fs / 인메모리 fixture 를 넣어 호출.
 */

import nodeFs from 'node:fs';
import path from 'node:path';

// ─────────────────────────── 정규식 (export 해서 테스트 가능) ───────────────────────────

/** `import.meta.env.VITE_FOO` / `import.meta.env?.VITE_FOO` 둘 다 잡는다. */
export const SRC_VITE_RE = /import\.meta\.env\??\.(VITE_[A-Z0-9_]+)/g;

/**
 * Dockerfile 의 `ARG VITE_FOO[=default]` 라인. 줄 단위 매칭.
 * 뒤따르는 inline 주석 (`# ...`) 도 허용 (Gemini #596).
 */
export const DOCKERFILE_ARG_RE = /^\s*ARG\s+(VITE_[A-Z0-9_]+)(?:\s*=[^#]*)?\s*(?:#.*)?$/;

/** deploy.yml 의 build-args 항목 `VITE_FOO=...`. 들여쓰기 + 값 허용. */
export const DEPLOY_BUILD_ARG_RE = /^\s+(VITE_[A-Z0-9_]+)\s*=/;

/** deploy.yml 의 `build-args:` 키 라인. literal block scalar (`|` / `>`) 모두 허용. */
export const DEPLOY_BUILD_ARGS_KEY_RE = /^(\s*)build-args:\s*[|>][+-]?\s*$/;

// ─────────────────────────── 어댑터 ───────────────────────────

/**
 * 디폴트 fs 어댑터. 실제 디스크에서 읽는다.
 * 테스트에선 인메모리 객체로 교체.
 */
export function defaultFs() {
  return {
    readFile: (p) => nodeFs.readFileSync(p, 'utf8'),
    readdir: (p) => nodeFs.readdirSync(p, { withFileTypes: true }),
    exists: (p) => nodeFs.existsSync(p),
  };
}

// ─────────────────────────── 수집 ───────────────────────────

/**
 * 디렉토리를 재귀 순회하며 `.js / .jsx / .ts / .tsx / .mjs / .cjs` 파일에서
 * `import.meta.env.VITE_*` 를 모은다. node_modules / dist / build / .turbo 는 스킵.
 *
 * @param {string} dir
 * @param {ReturnType<typeof defaultFs>} fs
 * @returns {Set<string>} VITE_* 이름 집합
 */
export function collectSrcViteVars(dir, fs) {
  const out = new Set();
  if (!fs.exists(dir)) return out;

  const SKIP = new Set(['node_modules', 'dist', 'build', '.turbo', '.next', 'coverage']);
  const EXT = /\.(?:m?jsx?|cjs|tsx?)$/i;

  /** @param {string} d */
  const walk = (d) => {
    for (const entry of fs.readdir(d)) {
      // 숨김 + `.` / `..` 모두 스킵 (Gemini #596 — `.` 가 들어오면 무한 재귀 위험).
      if (entry.name.startsWith('.')) continue;
      if (SKIP.has(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && EXT.test(entry.name)) {
        const text = fs.readFile(full);
        for (const m of text.matchAll(SRC_VITE_RE)) out.add(m[1]);
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * Dockerfile 텍스트에서 `ARG VITE_*` 이름만 추출.
 * @param {string} text
 * @returns {Set<string>}
 */
export function collectDockerfileViteArgs(text) {
  const out = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(DOCKERFILE_ARG_RE);
    if (m) out.add(m[1]);
  }
  return out;
}

/**
 * deploy.yml 텍스트에서 `build-args:` literal block 안의 VITE_* 이름만 추출.
 *
 * 이전엔 파일 전체에서 `<들여쓰기>VITE_FOO=...` 행을 다 잡았지만, build-args
 * 밖의 env / shell 라인이 오인식될 수 있어서 (CodeRabbit #596) 블록 안만
 * 보도록 좁혔다. 블록은 `build-args: |` (또는 `|+` / `|-` / `>`) 키 라인
 * 다음에 시작하고, 들여쓰기가 키 행 들여쓰기보다 작아지거나 같아지면 종료.
 *
 * 동일 step 안에 build-args 가 여러 번 나오는 일은 없지만, 여러 step 에
 * build-args 가 있는 경우는 누적 수집.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function collectDeployViteBuildArgs(text) {
  const out = new Set();
  const lines = text.split(/\r?\n/);

  let inside = false;
  let keyIndent = -1; // build-args: 키 라인 자체의 들여쓰기
  let blockIndent = -1; // 첫 컨텐츠 행을 보고 결정

  for (const raw of lines) {
    if (!inside) {
      const m = raw.match(DEPLOY_BUILD_ARGS_KEY_RE);
      if (m) {
        inside = true;
        keyIndent = m[1].length;
        blockIndent = -1;
      }
      continue;
    }

    // 공백/주석 라인은 블록 종료 판단에서 제외 — YAML literal block 관용.
    if (raw.trim() === '' || /^\s*#/.test(raw)) continue;

    const indent = raw.match(/^\s*/)[0].length;

    // 첫 컨텐츠 행 들여쓰기를 블록 들여쓰기로 고정.
    if (blockIndent === -1) {
      if (indent <= keyIndent) {
        // 빈 블록 — 즉시 종료.
        inside = false;
        continue;
      }
      blockIndent = indent;
    } else if (indent <= keyIndent) {
      // 블록 종료 — 같은 레벨 또는 dedent.
      inside = false;
      // 이 라인 자체도 다시 키 라인일 수 있으니 매칭 시도.
      const m = raw.match(DEPLOY_BUILD_ARGS_KEY_RE);
      if (m) {
        inside = true;
        keyIndent = m[1].length;
        blockIndent = -1;
      }
      continue;
    }

    const m = raw.match(DEPLOY_BUILD_ARG_RE);
    if (m) out.add(m[1]);
  }
  return out;
}

// ─────────────────────────── 비교 ───────────────────────────

/**
 * @typedef {object} WebReport
 * @property {string} app                    web 앱 이름 (e.g. "hobby-web")
 * @property {Set<string>} srcVars           src 에서 사용하는 VITE_*
 * @property {Set<string>} dockerArgs        그 web Dockerfile 의 ARG VITE_*
 * @property {string[]} missingInDockerfile  src 에 있는데 Dockerfile 에 없음 (BLOCK)
 * @property {string[]} unusedInDockerfile   Dockerfile 에 있는데 src 에 없음 (WARN)
 */

/**
 * @typedef {object} DriftReport
 * @property {WebReport[]} webs
 * @property {Set<string>} dockerUnion         모든 web Dockerfile ARG 합집합
 * @property {Set<string>} deployBuildArgs     deploy.yml build-args 의 VITE_*
 * @property {Array<{app: string, name: string}>} missingInDeploy  Dockerfile 에 있는데 deploy.yml 에 없음 (BLOCK)
 * @property {string[]} unusedInDeploy         deploy.yml 에 있는데 어떤 Dockerfile 에도 없음 (WARN)
 * @property {string[]} errors                 BLOCK 사항을 사람 친화 메시지로
 * @property {string[]} warnings               WARN 사항을 사람 친화 메시지로
 */

/**
 * 전체 정합성 검사.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot
 * @param {string[]} opts.webApps                e.g. ['landing','auth-web','hobby-web','shelf-web','letter-web','board-web']
 * @param {string} opts.deployYmlPath            repoRoot 상대 경로
 * @param {ReturnType<typeof defaultFs>} [opts.fs]
 * @returns {DriftReport}
 */
export function analyzeDrift({ repoRoot, webApps, deployYmlPath, fs = defaultFs() }) {
  /** @type {WebReport[]} */
  const webs = [];
  const dockerUnion = new Set();
  /** @type {Array<{app: string, name: string}>} */
  const missingInDeploy = [];
  const errors = [];
  const warnings = [];

  for (const app of webApps) {
    const appDir = path.join(repoRoot, 'apps', app);
    const srcDir = path.join(appDir, 'src');
    const dockerfilePath = path.join(appDir, 'Dockerfile');

    if (!fs.exists(dockerfilePath)) {
      errors.push(`[${app}] Dockerfile 누락: ${dockerfilePath}`);
      continue;
    }

    const srcVars = collectSrcViteVars(srcDir, fs);
    const dockerArgs = collectDockerfileViteArgs(fs.readFile(dockerfilePath));
    for (const a of dockerArgs) dockerUnion.add(a);

    const missingInDockerfile = [...srcVars].filter((v) => !dockerArgs.has(v)).sort();
    const unusedInDockerfile = [...dockerArgs].filter((v) => !srcVars.has(v)).sort();

    for (const name of missingInDockerfile) {
      errors.push(
        `[BLOCK] ${app}/src 가 ${name} 를 사용하는데 apps/${app}/Dockerfile 에 ARG ${name} 없음. ` +
          `Vite 빌드 시 fallback 으로 떨어져 incident #585 패턴 재발.`,
      );
    }
    for (const name of unusedInDockerfile) {
      warnings.push(
        `[WARN] ${app}/Dockerfile 에 ARG ${name} 있지만 ${app}/src 에서 사용 안 함. ` +
          `(6 web 통일성 목적이면 OK)`,
      );
    }

    webs.push({ app, srcVars, dockerArgs, missingInDockerfile, unusedInDockerfile });
  }

  const deployFullPath = path.join(repoRoot, deployYmlPath);
  let deployBuildArgs = new Set();
  if (!fs.exists(deployFullPath)) {
    errors.push(`deploy.yml 누락: ${deployFullPath}`);
  } else {
    deployBuildArgs = collectDeployViteBuildArgs(fs.readFile(deployFullPath));
  }

  for (const w of webs) {
    for (const name of w.dockerArgs) {
      if (!deployBuildArgs.has(name)) {
        missingInDeploy.push({ app: w.app, name });
        errors.push(
          `[BLOCK] apps/${w.app}/Dockerfile 에 ARG ${name} 선언됐지만 ` +
            `.github/workflows/deploy.yml build-args 에 ${name} 전달 안 됨. ` +
            `이미지 빌드 시 default 만 박혀 prod env override 불가.`,
        );
      }
    }
  }

  const unusedInDeploy = [...deployBuildArgs].filter((v) => !dockerUnion.has(v)).sort();
  for (const name of unusedInDeploy) {
    warnings.push(
      `[WARN] deploy.yml build-args 에 ${name} 전달하지만 어떤 web Dockerfile 도 ARG ${name} 선언 안 함. ` +
        `docker 가 무시 (무해) 하지만 정리 권장.`,
    );
  }

  return { webs, dockerUnion, deployBuildArgs, missingInDeploy, unusedInDeploy, errors, warnings };
}

/**
 * 사람 친화 리포트 문자열.
 * @param {DriftReport} r
 * @returns {string}
 */
export function formatReport(r) {
  const lines = [];
  lines.push('VITE_* build args drift 검사');
  lines.push('='.repeat(60));
  for (const w of r.webs) {
    lines.push(
      `  ${w.app.padEnd(11)}  src=${w.srcVars.size}  Dockerfile ARG=${w.dockerArgs.size}` +
        (w.missingInDockerfile.length ? `  MISSING=${w.missingInDockerfile.join(',')}` : ''),
    );
  }
  lines.push(`  deploy.yml build-args VITE_*=${r.deployBuildArgs.size}`);
  lines.push('');
  if (r.errors.length === 0 && r.warnings.length === 0) {
    lines.push('OK — drift 없음.');
  } else {
    if (r.errors.length) {
      lines.push(`ERRORS (${r.errors.length}):`);
      for (const e of r.errors) lines.push(`  - ${e}`);
    }
    if (r.warnings.length) {
      lines.push(`WARNINGS (${r.warnings.length}):`);
      for (const w of r.warnings) lines.push(`  - ${w}`);
    }
  }
  return lines.join('\n');
}
