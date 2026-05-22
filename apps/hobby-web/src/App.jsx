import { Navigate, Route, Routes } from 'react-router-dom';

import { HobbyLayout } from './components/HobbyLayout.jsx';
import { SchoolAuthGate } from './components/SchoolAuthGate.jsx';
import { ApplicantsPage } from './pages/ApplicantsPage.jsx';
import { CreatePostPage } from './pages/CreatePostPage.jsx';
import { EditPostPage } from './pages/EditPostPage.jsx';
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
 *
 * #562 — `<SchoolAuthGate>` 가 모든 라우트를 감싸 로그인 + 학교 미인증자
 * 의 페이지 진입 자체를 차단한다. PRD 변경: hobby 사용 자체 학교 인증 필수.
 * 비로그인은 각 페이지의 자체 SSO redirect 흐름 그대로.
 */
export const App = () => {
  return (
    <SchoolAuthGate>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/posts/:id" element={<PostDetailPage />} />
        <Route path="/posts/:id/edit" element={<EditPostPage />} />
        <Route path="/posts/:id/applicants" element={<ApplicantsPage />} />
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
    </SchoolAuthGate>
  );
};
