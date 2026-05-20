import { Navigate, Route, Routes } from 'react-router-dom';

import { HobbyLayout } from './components/HobbyLayout.jsx';
import { CreatePostPage } from './pages/CreatePostPage.jsx';
import { HomePage } from './pages/HomePage.jsx';

/**
 * hobby-web 루트.
 *
 * Routes:
 *  - /       → HomePage (모집 카드 리스트, Issue #37). 자체 Header 보유 → HobbyLayout wrap X.
 *  - /new    → CreatePostPage (Issue #38). HobbyLayout 으로 wrap.
 *  - 그 외   → / 로 리다이렉트.
 */
export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/new"
        element={
          <HobbyLayout>
            <CreatePostPage />
          </HobbyLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
