/**
 * Playful 페르소나 카드 팔레트 — 6색. 시안 (playful.html) 의 card-* gradient 와 매칭.
 *
 * `serialize` 가 게시글의 첫 태그 이름을 기준으로 색을 결정한다.
 * 태그가 없거나 매칭이 안 되면 id 해시로 fallback — 같은 게시글은 항상 같은 색.
 */

/** @type {{ key: string; gradient: string; text: string; chip: string; pill: string; btn: string; tilt: string }[]} */
const PALETTE = [
  {
    key: 'coral',
    gradient: 'card-coral',
    text: 'text-white',
    chip: 'bg-white/20 text-white',
    pill: 'bg-white/95 text-rose-600',
    btn: 'bg-white/95 text-rose-600',
    tilt: 'tilt-l',
  },
  {
    key: 'lime',
    gradient: 'card-lime',
    text: 'text-emerald-950',
    chip: 'bg-emerald-900/15 text-emerald-950',
    pill: 'bg-emerald-950 text-lime-200',
    btn: 'bg-emerald-950 text-lime-200',
    tilt: 'tilt-r',
  },
  {
    key: 'violet',
    gradient: 'card-violet',
    text: 'text-white',
    chip: 'bg-white/20 text-white',
    pill: 'bg-white/95 text-violet-700',
    btn: 'bg-white/95 text-violet-700',
    tilt: 'tilt-l2',
  },
  {
    key: 'sun',
    gradient: 'card-sun',
    text: 'text-white',
    chip: 'bg-white/20 text-white',
    pill: 'bg-white/95 text-orange-700',
    btn: 'bg-white/95 text-orange-700',
    tilt: 'tilt-r2',
  },
  {
    key: 'sky',
    gradient: 'card-sky',
    text: 'text-white',
    chip: 'bg-white/20 text-white',
    pill: 'bg-white/95 text-sky-700',
    btn: 'bg-white/95 text-sky-700',
    tilt: 'tilt-l',
  },
  {
    key: 'mint',
    gradient: 'card-mint',
    text: 'text-emerald-950',
    chip: 'bg-emerald-900/15 text-emerald-950',
    pill: 'bg-emerald-950 text-emerald-100',
    btn: 'bg-emerald-950 text-emerald-100',
    tilt: 'tilt-r2',
  },
];

/** 태그 이름 → 팔레트 매핑. 매칭 없으면 hash fallback. */
const TAG_TO_PALETTE = {
  맛집: 'coral',
  마라탕: 'coral',
  스포츠: 'lime',
  풋살: 'lime',
  보드게임: 'violet',
  스터디: 'sky',
  카페: 'sun',
  알고리즘: 'sky',
  야구: 'mint',
};

/**
 * 문자열 → 비음수 정수 hash (djb2 변형).
 *
 * @param {string} s
 * @returns {number}
 */
const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
};

/**
 * 카드 색 결정.
 *
 * @param {{ id: string; tags: { name: string }[]; status: string }} post
 * @returns {(typeof PALETTE)[number]}
 */
export const paletteFor = (post) => {
  const tagKey = post.tags?.find((t) => TAG_TO_PALETTE[t.name])?.name;
  if (tagKey) {
    const target = TAG_TO_PALETTE[tagKey];
    const found = PALETTE.find((p) => p.key === target);
    if (found) return found;
  }
  return PALETTE[hash(post.id) % PALETTE.length];
};

/** 이모지 매핑 — 태그 기반. 없으면 기본 🎯. */
const TAG_TO_EMOJI = {
  마라탕: '🍜',
  맛집: '🍽',
  풋살: '⚽',
  스포츠: '⚽',
  보드게임: '🎲',
  카페: '☕',
  스터디: '🧠',
  알고리즘: '🧠',
  코테: '🧠',
  야구: '⚾',
  직관: '⚾',
  카탄: '🎲',
};

/**
 * 게시글 → 대표 이모지.
 *
 * @param {{ tags: { name: string }[] }} post
 * @returns {string}
 */
export const emojiFor = (post) => {
  const matched = post.tags?.find((t) => TAG_TO_EMOJI[t.name]);
  return matched ? TAG_TO_EMOJI[matched.name] : '🎯';
};
