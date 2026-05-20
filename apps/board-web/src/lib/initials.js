/**
 * 사용자 이름/식별자 → 2글자 이내의 이니셜 (아바타용).
 *
 * - 한글: 마지막 2글자 그대로 (예: "김진현" → "진현")
 * - 영문/숫자: 단어별 첫 글자 (예: "John Doe" → "JD", "alice" → "AL")
 * - 비어있으면 "??"
 *
 * @param {string | null | undefined} input
 * @returns {string}
 */
export const initials = (input) => {
  if (!input) return '??';
  const trimmed = String(input).trim();
  if (!trimmed) return '??';
  // 한글 포함이면 마지막 2글자
  if (/[가-힣]/.test(trimmed)) {
    const compact = trimmed.replace(/\s+/g, '');
    return compact.slice(-2).toUpperCase();
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
};

/**
 * 사용자 id(또는 이름) → 결정적인 아바타 톤 클래스.
 * 시안의 4가지 톤(인디고/잉크-900/잉크-500/잉크-300)을 사용자별로 균등 분포.
 *
 * @param {string} key
 * @returns {string} 적용할 Tailwind 클래스 (배경 + 글자색 + ring)
 */
export const avatarTone = (key) => {
  const tones = [
    'bg-indigo-accent text-white',
    'bg-foreground text-background',
    'bg-zinc-500 text-white',
    'bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  ];
  const str = String(key ?? '');
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % tones.length;
  return tones[idx];
};
