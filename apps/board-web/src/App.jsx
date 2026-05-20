import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/AppLayout.jsx';
import { BoardsPage } from './pages/BoardsPage.jsx';
import { BoardViewPage } from './pages/BoardViewPage.jsx';

/**
 * board-web 루트.
 * Routes:
 *  - /boards        → BoardsPage (프로젝트 목록)
 *  - /boards/:id    → BoardViewPage (개별 칸반 보드)
 *  - /              → /boards redirect
 *  - 그 외          → /boards redirect
 */
export const App = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/boards/:id" element={<BoardViewPage />} />
        <Route path="/" element={<Navigate to="/boards" replace />} />
        <Route path="*" element={<Navigate to="/boards" replace />} />
      </Routes>
    </AppLayout>
  );
};
