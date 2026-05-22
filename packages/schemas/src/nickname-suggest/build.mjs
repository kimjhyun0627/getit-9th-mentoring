/**
 * `data.js` 재생성 스크립트.
 *
 * JSON 데이터셋 (`adjectives.json`, `nouns.json`) 을 브라우저 호환 ES 모듈로 변환.
 * Node 의 `fs`/`url` 을 런타임에 쓰지 않게 만들어 FE 번들 호환성 확보.
 *
 *   node packages/schemas/src/nickname-suggest/build.mjs
 *
 * 데이터셋 추가/수정 후 반드시 실행해 `data.js` 도 같이 commit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const adj = JSON.parse(readFileSync(here('./adjectives.json'), 'utf-8'));
const nouns = JSON.parse(readFileSync(here('./nouns.json'), 'utf-8'));

const fmt = (arr) => {
  const lines = [];
  for (let i = 0; i < arr.length; i += 10) {
    lines.push(`  ${arr.slice(i, i + 10).map((x) => JSON.stringify(x)).join(', ')},`);
  }
  return lines.join('\n');
};

const out = `// AUTO-GENERATED from \`./adjectives.json\` + \`./nouns.json\` — do NOT edit.
// Run \`node packages/schemas/src/nickname-suggest/build.mjs\` to regenerate.
// Inline data lets this module load in the browser (no fs/url deps) — required for
// FE bundling. JSON files remain as canonical source for human review.

export const ADJECTIVES = Object.freeze([
${fmt(adj)}
]);

export const NOUNS = Object.freeze([
${fmt(nouns)}
]);
`;

writeFileSync(here('./data.js'), out, 'utf-8');
console.log(`wrote data.js (adj=${adj.length}, nouns=${nouns.length})`);
