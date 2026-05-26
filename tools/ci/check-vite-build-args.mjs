#!/usr/bin/env node
/**
 * CI 가드: 6 web 의 VITE_* env 가 src ↔ Dockerfile ARG ↔ deploy.yml build-args
 * 사이에 drift 없이 동기화돼 있는지 검사.
 *
 * Incident (#585, 2026-05-26):
 *   hobby-web 의 학번 모달 PATCH 가 404 — `import.meta.env?.VITE_AUTH_API_URL`
 *   가 6 web Dockerfile + deploy.yml 어디에도 build-arg 로 전달 안 돼서
 *   `?? '/api'` fallback 이 번들에 박혔다.
 *
 * Drift 가 잡혔으면 exit code 1 + 무엇이 어디서 누락됐는지 사람 친화 메시지.
 * 정상이면 exit 0.
 *
 * Usage:
 *   node tools/ci/check-vite-build-args.mjs            # repo root 가 cwd 라고 가정
 *   node tools/ci/check-vite-build-args.mjs --root /path/to/repo
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeDrift, formatReport } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 6 web 앱 — `.github/workflows/deploy.yml` 의 matrix.app 중 -web/landing 만. */
const WEB_APPS = ['landing', 'auth-web', 'hobby-web', 'shelf-web', 'letter-web', 'board-web'];

function parseArgs(argv) {
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') {
      // 값 누락은 디폴트로 떨어뜨리지 말고 즉시 실패 — 설정 실수를 숨기지 않기 위해 (CodeRabbit #596).
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        process.stderr.write('Error: --root 옵션에 경로 값이 필요합니다.\n');
        process.exit(2);
      }
      root = next;
      i++;
    }
  }
  return { root };
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  // repo root: --root > tools/ci 부모의 부모 (tools/ci/../..) > cwd
  const repoRoot = path.resolve(root ?? path.join(__dirname, '..', '..'));

  const report = analyzeDrift({
    repoRoot,
    webApps: WEB_APPS,
    deployYmlPath: '.github/workflows/deploy.yml',
  });

  // stdout: 항상 사람 친화 리포트
  process.stdout.write(formatReport(report) + '\n');

  // exit: errors 있으면 1, 아니면 0 (warnings 는 비차단)
  if (report.errors.length > 0) {
    process.exit(1);
  }
}

main();
