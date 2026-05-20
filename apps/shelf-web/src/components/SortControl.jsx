/**
 * SortControl — 서재 정렬 select (#196).
 *
 * editorial 톤 유지: smallcaps 라벨 + 본문 serif 컨트롤. FilterTabs 옆에 배치되도록
 * pure presentational. URL 쿼리 sync 는 부모 (HomePage) 에서.
 *
 * @typedef {'addedAt-desc'|'addedAt-asc'|'completedAt-desc'|'rating-desc'|'title-asc'} SortKey
 *
 * @param {{
 *   value: SortKey;
 *   onChange: (next: SortKey) => void;
 *   className?: string;
 * }} props
 */
export const SortControl = ({ value, onChange, className }) => {
  /** @type {{ key: SortKey; label: string }[]} */
  const options = [
    { key: 'addedAt-desc', label: '최근 추가' },
    { key: 'addedAt-asc', label: '오래된 순' },
    { key: 'completedAt-desc', label: '최근 완독' },
    { key: 'rating-desc', label: '별점 높은 순' },
    { key: 'title-asc', label: '제목 가나다' },
  ];

  return (
    <label className={`flex items-center gap-2 ${className ?? ''}`}>
      <span className="smallcaps text-[10px]">Sort</span>
      <select
        aria-label="정렬"
        value={value}
        onChange={(e) => onChange(/** @type {SortKey} */ (e.target.value))}
        className="font-serif text-[12px] bg-transparent border-b border-rule-1 pb-[2px] focus:outline-none focus-visible:border-foreground"
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
};
