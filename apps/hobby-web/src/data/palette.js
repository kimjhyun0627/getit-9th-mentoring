/**
 * Playful 페르소나 카드 팔레트 — 6색. 시안 (playful.html) 의 card-* gradient 와 매칭.
 *
 * `serialize` 가 게시글의 첫 태그 이름을 기준으로 색을 결정한다.
 * 태그가 없거나 매칭이 안 되면 id 해시로 fallback — 같은 게시글은 항상 같은 색.
 *
 * Status tone (#309):
 *  - RECRUITING: 컬러 유지 (palette.gradient)
 *  - FULL: 컬러 유지 + 🎉 마감 amber 리본 (긍정적 종료, 잔치 분위기)
 *  - CLOSED: gray-out (`tone-closed`) + opacity 60% (부정/중립 종료)
 *
 * Status별 표시 텍스트는 `statusBadgeFor` 가 반환.
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

/**
 * 모집 상태별 표시 정보 — #309.
 *
 *  - RECRUITING: 액션 가능. 배지 X.
 *  - FULL: 정원 마감, 긍정적 종료 (오픈채팅 활성). amber 리본.
 *  - CLOSED: 모집 종료 / 만료. 회색 톤 + 비활성.
 *
 * `tone` 은 카드 자체에 추가로 적용할 클래스:
 *  - 'active' = 변형 없음
 *  - 'full' = ribbon 노출, 카드 채도 유지
 *  - 'closed' = grayscale + opacity-80 + 회색 pill (line-through 제거, #447)
 *    line-through + grayscale + opacity 가 겹쳐 본문 가독성 떨어졌음. 다크모드에서 특히.
 *    회색 톤 + pill 만으로도 종료 식별 충분 — 본문은 읽기 쉽게 둠.
 *
 * @param {{ status: string }} post
 * @returns {{
 *   tone: 'active' | 'full' | 'closed';
 *   inactive: boolean;
 *   label: string | null;
 *   ribbon: { text: string; cls: string } | null;
 *   bodyCls: string;
 * }}
 */
export const statusBadgeFor = (post) => {
  if (post.status === 'FULL') {
    return {
      tone: 'full',
      inactive: true,
      label: '정원 마감',
      ribbon: {
        text: '🎉 마감',
        // amber + 짙은 슬레이트 글자 = WCAG AA 통과 (4.5:1+)
        cls: 'bg-amber-300 text-slate-900 ring-1 ring-amber-500/40',
      },
      bodyCls: '',
    };
  }
  if (post.status === 'CLOSED') {
    return {
      tone: 'closed',
      inactive: true,
      label: '모집 종료',
      ribbon: null,
      // #447 — line-through 제거. tone-closed (grayscale) + opacity-80 + 회색 pill 로 충분.
      bodyCls: '',
    };
  }
  return { tone: 'active', inactive: false, label: null, ribbon: null, bodyCls: '' };
};
