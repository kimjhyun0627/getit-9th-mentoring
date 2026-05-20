import { Navigate, Route, Routes } from 'react-router-dom';

import { ShelfLayout } from './components/ShelfLayout.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';

/**
 * shelf-web 루트.
 * Routes:
 *  - /        → HomePage (내 서재, #44)
 *  - /search  → SearchPage (책 검색 + 서재 추가, #43)
 *  - 그 외    → / redirect
 */
export const App = () => {
  return (
    <ShelfLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShelfLayout>
  );
};
