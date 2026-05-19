/**
 * 페이지 최하단 푸터. 1px hairline 상단 보더.
 * 좌: copyright, 우: build 메타.
 */
export const Footer = () => {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-10 lg:px-10 sm:flex-row sm:items-center">
        <p className="text-xs text-muted-foreground">© GETIT 9기 멘토링 · 경북대학교 IT 학회</p>
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground/80">
          get-it.cloud · build/9.0.1
        </p>
      </div>
    </footer>
  );
};
