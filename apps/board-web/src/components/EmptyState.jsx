/**
 * 빈 상태 — placeholder + CTA.
 * 시안의 `empty-add` (dashed border) 톤을 차용해 카드 자리 비어있음을 명확히.
 *
 * @param {{
 *   title: string;
 *   description: string;
 *   action?: import('react').ReactNode;
 * }} props
 */
export const EmptyState = ({ title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-hairline px-6 py-16 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
};
