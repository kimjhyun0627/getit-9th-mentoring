import { Navigate, Route, Routes } from 'react-router-dom';

import { ShelfLayout } from './components/ShelfLayout.jsx';
import { SearchPage } from './pages/SearchPage.jsx';

/**
 * shelf-web 루트.
 * Routes:
 *  - /search → SearchPage (책 검색 + 서재 추가)
 *  - /      → /search redirect
 *  - 그 외  → /search redirect
 *
 * FE-shelf (#44) 가 /shelf 추가 예정 — 머지 시 충돌 처리.
 */
export const App = () => {
  return (
    <ShelfLayout>
      <Routes>
        <Route path="/search" element={<SearchPage />} />
        <Route path="/" element={<Navigate to="/search" replace />} />
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Routes>
    </ShelfLayout>
  );
};
