import { Navigate, Route, Routes } from 'react-router-dom';

import { ShelfLayout } from './components/ShelfLayout.jsx';
import { BookDetailPage } from './pages/BookDetailPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { UserShelfPage } from './pages/UserShelfPage.jsx';

/**
 * shelf-web 루트.
 * Routes:
 *  - /             → HomePage (내 서재, #44)
 *  - /search       → SearchPage (책 검색 + 서재 추가, #43)
 *  - /book/:isbn   → BookDetailPage (책 상세, #201)
 *  - /u/:userId    → UserShelfPage (다른 유저 공개 서재, #292)
 *  - 그 외         → / redirect
 */
export const App = () => {
  return (
    <ShelfLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/book/:isbn" element={<BookDetailPage />} />
        <Route path="/u/:userId" element={<UserShelfPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShelfLayout>
  );
};
