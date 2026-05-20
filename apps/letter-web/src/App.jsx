import { Navigate, Route, Routes } from 'react-router-dom';

import { LetterLayout } from './components/LetterLayout.jsx';
import { BoardPage } from './pages/BoardPage.jsx';

/**
 * letter-web 루트.
 *
 * Routes (Phase 3 — 점진 도입):
 *  - /      → BoardPage (현재는 ComposeModal 만 노출, board 뷰는 #54 머지 시 합체)
 *  - 그 외  → / 리다이렉트
 */
export const App = () => {
  return (
    <LetterLayout>
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LetterLayout>
  );
};
