import { Navigate, Route, Routes } from 'react-router-dom';

import { NicknameOnboardingGuard } from './components/NicknameOnboardingGuard.jsx';
import { ShelfLayout } from './components/ShelfLayout.jsx';
import { BookDetailPage } from './pages/BookDetailPage.jsx';
import { BrowsePage } from './pages/BrowsePage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { UserShelfPage } from './pages/UserShelfPage.jsx';

/**
 * shelf-web 루트.
 * Routes:
 *  - /             → HomePage (내 서재, #44)
 *  - /search       → SearchPage (책 검색 + 서재 추가, #43)
 *  - /browse       → BrowsePage (부원 서재 디렉토리, #561)
 *  - /book/:isbn   → BookDetailPage (책 상세, #201)
 *  - /u/:userId    → UserShelfPage (다른 유저 공개 서재, #292)
 *  - 그 외         → / redirect
 */
export const App = () => {
  return (
    <ShelfLayout>
      {/* school-auth (#540) — 로그인 사용자가 nickname null 이면 onboarding 강제 redirect */}
      <NicknameOnboardingGuard />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/book/:isbn" element={<BookDetailPage />} />
        <Route path="/u/:userId" element={<UserShelfPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShelfLayout>
  );
};
