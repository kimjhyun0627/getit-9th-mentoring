import { Navigate, Route, Routes } from 'react-router-dom';

import { HomePage } from './pages/HomePage.jsx';

/**
 * hobby-web 루트.
 * Routes:
 *  - /        → HomePage (모집 카드 리스트)
 *  - 그 외    → /  redirect
 *
 * 후속 이슈 (#38 작성, #39 상세) 에서 /new, /posts/:id 추가 예정.
 */
export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
