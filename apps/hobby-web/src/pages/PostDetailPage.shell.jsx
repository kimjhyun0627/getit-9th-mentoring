import { useState } from 'react';

import { Header } from '../components/Header.jsx';

/**
 * PostDetailPage 공통 shell — blob + dotted backdrop + 헤더.
 *
 * PostDetailPage.jsx 가 300줄을 넘지 않도록 분리.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export const PageShell = ({ children }) => {
  const [search, setSearch] = useState('');
  return (
    <div className="relative overflow-hidden min-h-screen">
      <div
        aria-hidden="true"
        className="blob"
        style={{
          width: 340,
          height: 340,
          top: -80,
          left: -60,
          background: 'radial-gradient(circle,#ff8aae 0%,transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="blob"
        style={{
          width: 300,
          height: 300,
          top: 80,
          right: -40,
          background: 'radial-gradient(circle,#a5b4fc 0%,transparent 65%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-dotted pointer-events-none" />
      <Header search={search} onSearchChange={setSearch} />
      {children}
    </div>
  );
};
