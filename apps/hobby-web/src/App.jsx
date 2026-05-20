import { Navigate, Route, Routes } from 'react-router-dom';

import { HomePage } from './pages/HomePage.jsx';
import { PostDetailPage } from './pages/PostDetailPage.jsx';

/**
 * hobby-web 루트.
 * Routes:
 *  - /             → HomePage (모집 카드 리스트, #37)
 *  - /posts/:id    → PostDetailPage (상세 + 신청, #39)
 *  - 그 외         → /  redirect
 *
 * 후속 이슈 (#38 작성) 에서 /new 추가 예정.
 */
export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/posts/:id" element={<PostDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
