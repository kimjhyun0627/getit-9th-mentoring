import { Navigate, Route, Routes } from 'react-router-dom';

import { HobbyLayout } from './components/HobbyLayout.jsx';
import { CreatePostPage } from './pages/CreatePostPage.jsx';

/**
 * hobby-web 루트.
 *
 * Routes (현재 Phase 3 — 페이지 점진 도입 중):
 *  - /new   → CreatePostPage (Issue #38)
 *  - /      → /new (FE-list #37 머지되면 / 로 옮기고 /new 는 그대로 유지)
 *  - 그 외  → /new 로 리다이렉트
 *
 * FE-list 머지 후 / 가 list 페이지를 잡고 /new 는 이 페이지 그대로 유지.
 */
export const App = () => {
  return (
    <HobbyLayout>
      <Routes>
        <Route path="/new" element={<CreatePostPage />} />
        <Route path="/" element={<Navigate to="/new" replace />} />
        <Route path="*" element={<Navigate to="/new" replace />} />
      </Routes>
    </HobbyLayout>
  );
};
