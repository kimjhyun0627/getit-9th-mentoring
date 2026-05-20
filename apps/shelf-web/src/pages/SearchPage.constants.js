/**
 * SearchPage 공유 상수.
 *
 * Fast-refresh 가드를 위해 컴포넌트와 상수 export 를 분리.
 */

/** @typedef {'all' | 'title' | 'person' | 'publisher' | 'isbn'} TargetKey */

/**
 * 검색 대상 토글 옵션 (#202).
 *
 * - all: 카카오 기본 (전체 필드)
 * - title / person / publisher / isbn: 카카오 target 파라미터 전달
 *
 * @type {{ value: TargetKey; label: string }[]}
 */
export const TARGET_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'title', label: '제목' },
  { value: 'person', label: '저자' },
  { value: 'publisher', label: '출판사' },
  { value: 'isbn', label: 'ISBN' },
];

/** 검색어 최대 길이 — BE 의 q ≤ 100자 상한과 동일 (#232). */
export const MAX_QUERY = 100;
