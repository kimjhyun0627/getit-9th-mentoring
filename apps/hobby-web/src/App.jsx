import { Navigate, Route, Routes } from 'react-router-dom';

import { HobbyLayout } from './components/HobbyLayout.jsx';
import { CreatePostPage } from './pages/CreatePostPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { MePage } from './pages/MePage.jsx';
import { PostDetailPage } from './pages/PostDetailPage.jsx';

/**
 * hobby-web 루트.
 *
 * Routes:
 *  - /             → HomePage (모집 카드 리스트). 자체 Header 보유.
 *  - /new          → CreatePostPage (작성 페이지). HobbyLayout wrap.
 *  - /posts/:id    → PostDetailPage (상세 + 신청). 자체 PageShell.
 *  - /me           → MePage (마이페이지 #228). 자체 Shell.
 *  - 그 외          → / 로 리다이렉트.
 */
export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/posts/:id" element={<PostDetailPage />} />
      <Route path="/me" element={<MePage />} />
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
