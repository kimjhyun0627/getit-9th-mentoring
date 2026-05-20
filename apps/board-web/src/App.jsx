import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/AppLayout.jsx';
import { BoardsPage } from './pages/BoardsPage.jsx';

/**
 * board-web 루트.
 * Routes:
 *  - /boards        → BoardsPage (프로젝트 목록)
 *  - /              → /boards redirect
 *  - 그 외          → /boards redirect
 *
 * `/boards/:id` (개별 보드 뷰) 는 별도 issue #50 에서 구현.
 */
export const App = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/" element={<Navigate to="/boards" replace />} />
        <Route path="*" element={<Navigate to="/boards" replace />} />
      </Routes>
    </AppLayout>
  );
};
