/**
 * 빈 서재 placeholder — editorial 톤.
 *
 * @param {{ filter: 'ALL'|'WANT'|'READING'|'READ' }} props
 */
export const EmptyShelf = ({ filter }) => {
  const message = messageFor(filter);
  return (
    <div
      className="border-t border-b themed-border py-16 text-center"
      style={{ borderColor: 'var(--rule-1)' }}
      role="status"
    >
      <p className="smallcaps mb-3 text-[11px]">An empty page</p>
      <h3 className="font-display tracking-hero text-2xl font-black leading-[1.1] md:text-3xl">
        {message.headline}
      </h3>
      <p className="essay-kr text-body mx-auto mt-3 max-w-[36ch] text-[14px] leading-relaxed">
        {message.body}
      </p>
      <a href="/search" className="ink-link mt-6 inline-block font-serif text-[13px]">
        책 찾으러 가기 →
      </a>
    </div>
  );
};

const messageFor = (filter) => {
  if (filter === 'READ') {
    return {
      headline: '아직 읽은 책이 없어.',
      body: '첫 한 권을 끝낼 때마다, 작게 어른이 되어가는 기분.',
    };
  }
  if (filter === 'READING') {
    return {
      headline: '지금 읽는 책이 없어.',
      body: '오늘 펼치는 한 페이지가 이번 계절의 첫 줄이 된다.',
    };
  }
  if (filter === 'WANT') {
    return {
      headline: '아직 위시리스트가 비어 있어.',
      body: '우연히 본 책 한 권을, 잊지 않게 여기에 적어두자.',
    };
  }
  return {
    headline: '서가가 비어 있어.',
    body: '한 사람이 모은 책장은, 결국 그 사람의 가장 정직한 자서전이다.',
  };
};
