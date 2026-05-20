import { Navigate, Route, Routes } from 'react-router-dom';

import { ShelfLayout } from './components/ShelfLayout.jsx';
import { HomePage } from './pages/HomePage.jsx';

/**
 * shelf-web 루트.
 * Routes:
 *  - /        → HomePage (내 서재)
 *  - 그 외    → / redirect
 *
 * 추후 PR (#43 검색, 후속 #N 상세) 에서 /search, /books/:isbn 추가.
 */
export const App = () => {
  return (
    <ShelfLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShelfLayout>
  );
};
