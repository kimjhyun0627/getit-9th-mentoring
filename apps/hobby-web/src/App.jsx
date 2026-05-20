import { Navigate, Route, Routes } from 'react-router-dom';

import { HobbyLayout } from './components/HobbyLayout.jsx';
import { CreatePostPage } from './pages/CreatePostPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { PostDetailPage } from './pages/PostDetailPage.jsx';

/**
 * hobby-web 루트.
 *
 * Routes:
 *  - /             → HomePage (모집 카드 리스트, #37)
 *  - /new          → CreatePostPage (작성 페이지, #38)
 *  - /posts/:id    → PostDetailPage (상세 + 신청, #39)
 *  - 그 외          → / redirect
 *
 * 상세 페이지는 자체 PageShell 을 가지므로 HobbyLayout 바깥에서 렌더.
 */
export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/posts/:id" element={<PostDetailPage />} />
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
