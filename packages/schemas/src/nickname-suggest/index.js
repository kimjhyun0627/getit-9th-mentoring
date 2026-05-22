/**
 * 닉네임 자동추천 — `A하는B` 패턴 (Issue #557).
 *
 * - 형용사 100 × 명사 100 = 10,000 조합. 무난한 한국어 어휘만 골랐다.
 * - 닉네임 정규식 `^[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\-_]+$` 와 충돌 방지 위해 **공백 없이** 결합.
 *   사용자 요구 예시 "느긋한 너구리" 는 노출 표기일 뿐 저장은 `느긋한너구리`.
 * - BE/FE 공유 (signup BE auto-fill + auth-web placeholder).
 *
 * @module nickname-suggest
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// JSON import attributes (`with { type: 'json' }`) 는 Node 20.10+ 만 지원 →
// CI/로컬 Node 버전 편차 최소화하려 동기 fs read 로 통일. 모듈 첫 로드 시 1회.
const adjPath = fileURLToPath(new URL('./adjectives.json', import.meta.url));
const nounPath = fileURLToPath(new URL('./nouns.json', import.meta.url));

/** @type {string[]} */
const adjectives = JSON.parse(readFileSync(adjPath, 'utf-8'));
/** @type {string[]} */
const nouns = JSON.parse(readFileSync(nounPath, 'utf-8'));

/**
 * 형용사 dataset (100개).
 *
 * @type {string[]}
 */
export const ADJECTIVES = Object.freeze([...adjectives]);

/**
 * 명사 dataset (100개).
 *
 * @type {string[]}
 */
export const NOUNS = Object.freeze([...nouns]);

/**
 * 형용사 × 명사 random pick — 공백 없이 결합.
 *
 * 결정론적 테스트를 위해 `rng` 주입 가능 (`Math.random` 기본).
 *
 * @param {() => number} [rng]
 * @returns {string} 예: "느긋한너구리"
 */
export const randomNicknameSuggestion = (rng = Math.random) => {
  const a = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(rng() * NOUNS.length)];
  return `${a}${n}`;
};
