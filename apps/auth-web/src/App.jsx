import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthenticatedRedirect } from './components/AuthenticatedRedirect.jsx';
import { AuthLayout } from './components/AuthLayout.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';

/**
 * auth-web 루트.
 *
 * Routes:
 *  - /login            → LoginPage (이미 로그인이면 redirect — Issue #295)
 *  - /signup           → SignupPage (이미 로그인이면 redirect — Issue #295)
 *  - /forgot-password  → ForgotPasswordPage (Issue #221)
 *  - /reset-password   → ResetPasswordPage (Issue #221)
 *  - /                 → /login redirect
 *  - 그 외              → /login redirect
 *
 * Login/Signup 은 AuthenticatedRedirect 가 mount 시 /api/me 로 세션 확인.
 * Forgot/Reset 은 가드 없음 — 로그인 상태에서도 비밀번호를 바꿀 수 있어야 한다.
 */
export const App = () => {
  return (
    <AuthLayout>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthenticatedRedirect>
              <LoginPage />
            </AuthenticatedRedirect>
          }
        />
        <Route
          path="/signup"
          element={
            <AuthenticatedRedirect>
              <SignupPage />
            </AuthenticatedRedirect>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthLayout>
  );
};
