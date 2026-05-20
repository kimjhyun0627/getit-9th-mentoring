/**
 * 컬럼 헤더 accent dot 색 결정 (#227).
 *
 * 디자인 원칙: Minimalist 톤이라 화려한 컬러 팔레트는 피한다. 기본 3컬럼
 * (Todo / Doing / Done) 는 기존 톤 유지 — 그 외 사용자 정의 컬럼은
 * 이름 해시 → 결정적 palette rotation 으로 회색 일변도 탈피.
 *
 * 트레이드오프: 컬럼명 변경 시 색이 바뀐다. 사용자 선택형 color 필드는
 * follow-up 으로 분리 (Prisma migration 비용 회피).
 *
 * @param {string} name
 * @returns {string} Tailwind class
 */
export const columnAccentClass = (name) => {
  if (name === 'Doing') return 'bg-indigo-accent';
  if (name === 'Done') return 'bg-foreground';
  if (name === 'Todo') return 'bg-muted-foreground/60';
  // 커스텀 컬럼: 결정적 해시 → 6-color rotation.
  // 모두 Tailwind 기본 색상의 -500 / dark 모드 -400 보조 — Minimalist 톤 안에서 식별 가능 수준.
  const palette = [
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-sky-500',
    'bg-violet-500',
    'bg-fuchsia-500',
  ];
  const idx = hashIndex(name, palette.length);
  return palette[idx];
};

/**
 * djb2 변형 해시 — 같은 이름이면 같은 색.
 *
 * @param {string} s
 * @param {number} mod
 * @returns {number}
 */
const hashIndex = (s, mod) => {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % Math.max(1, mod);
};
