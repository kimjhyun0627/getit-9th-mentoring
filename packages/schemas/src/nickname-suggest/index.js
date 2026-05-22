/**
 * 닉네임 자동추천 — `A하는B` 패턴 (Issue #557).
 *
 * - 형용사 100 × 명사 100 = 10,000 조합. 무난한 한국어 어휘만 골랐다.
 * - 닉네임 정규식 `^[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\-_]+$` 와 충돌 방지 위해 **공백 없이** 결합.
 *   사용자 요구 예시 "느긋한 너구리" 는 노출 표기일 뿐 저장은 `느긋한너구리`.
 * - BE/FE 공유 (signup BE auto-fill + auth-web placeholder).
 *   `node:fs`/`node:url` 등 Node-only API 의존 X — 브라우저 번들 호환 (data.js 인라인).
 *
 * @module nickname-suggest
 */
import { ADJECTIVES, NOUNS } from './data.js';

export { ADJECTIVES, NOUNS };

/**
 * 형용사 × 명사 random pick — 공백 없이 결합.
 *
 * 결정론적 테스트를 위해 `rng` 주입 가능 (`Math.random` 기본).
 * 방어: `rng()` 가 NaN / 음수 / 1 이상이어도 안전한 인덱스로 clamp (CR 피드백 #557).
 *
 * @param {() => number} [rng]
 * @returns {string} 예: "느긋한너구리"
 */
export const randomNicknameSuggestion = (rng = Math.random) => {
  const toIndex = (len) => {
    const raw = rng();
    // NaN / Infinity 방어: 0. 음수: 0. 1 이상: just-under-1.
    const normalized = Number.isFinite(raw) ? Math.min(0.9999999999, Math.max(0, raw)) : 0;
    return Math.floor(normalized * len);
  };
  const a = ADJECTIVES[toIndex(ADJECTIVES.length)];
  const n = NOUNS[toIndex(NOUNS.length)];
  return `${a}${n}`;
};
