import { useMemo } from 'react';

/**
 * 비밀번호 강도 표시 (Issue #265).
 *
 * 점수 산정:
 *  - 8자 이상: +1
 *  - 12자 이상: +1
 *  - 영문/숫자/특수 카테고리 수: +(count - 1)  (최대 +2)
 * → 총 0~4. 시각적 4단계 + 라벨.
 *
 * 운영 검증은 schemas/auth.js 의 passwordStrong refine 이 담당. 본 컴포넌트는 가이드.
 *
 * @param {{ value?: string }} props
 */
export const PasswordStrength = ({ value = '' }) => {
  const { score, label, tone } = useMemo(() => analyze(value), [value]);

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`h-1 flex-1 rounded-full transition ${
              i < score ? tone : 'bg-zinc-200 dark:bg-zinc-800'
            }`}
          />
        ))}
      </div>
      {value ? (
        <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          비밀번호 강도 <span className="text-zinc-300 dark:text-zinc-700">·</span>{' '}
          <span data-testid="pw-strength-label">{label}</span>
        </p>
      ) : (
        <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          영문 / 숫자 / 특수문자 중 2종 이상 · 8자 이상 권장
        </p>
      )}
    </div>
  );
};

/**
 * 비밀번호 강도 분석 (#466 — 정책 동기화 + 테스트 가능하도록 export).
 *
 * 정책 동기화 (`packages/schemas/src/auth.js passwordStrong`):
 *  - 8자 이상 + 영문/숫자/특수 중 2종 이상 → zod refine 통과 (최소 "약함").
 *  - 8자 미만 또는 1종만 → zod fail ("매우 약함").
 *
 * @param {string} v
 * @returns {{ score: 0|1|2|3|4, label: string, tone: string, passesPolicy: boolean }}
 */
export const analyzePasswordStrength = (v) => {
  if (!v)
    return {
      score: 0,
      label: '입력 없음',
      tone: 'bg-zinc-200 dark:bg-zinc-800',
      passesPolicy: false,
    };
  let s = 0;
  if (v.length >= 8) s += 1;
  if (v.length >= 12) s += 1;
  const cats =
    Number(/[a-zA-Z]/.test(v)) + Number(/[0-9]/.test(v)) + Number(/[^a-zA-Z0-9]/.test(v));
  s += Math.max(0, cats - 1);
  s = Math.min(4, s);
  const passesPolicy = v.length >= 8 && cats >= 2;
  if (s <= 1) return { score: s, label: '매우 약함', tone: 'bg-rose-500', passesPolicy };
  if (s === 2) return { score: s, label: '약함', tone: 'bg-amber-500', passesPolicy };
  if (s === 3) return { score: s, label: '보통', tone: 'bg-lime-500', passesPolicy };
  return { score: s, label: '강함', tone: 'bg-cyan-500', passesPolicy };
};

const analyze = analyzePasswordStrength;
