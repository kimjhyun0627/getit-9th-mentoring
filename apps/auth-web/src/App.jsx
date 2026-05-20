import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthenticatedRedirect } from './components/AuthenticatedRedirect.jsx';
import { AuthLayout } from './components/AuthLayout.jsx';
import { DeleteAccountPage } from './pages/DeleteAccountPage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx';
import { SessionsPage } from './pages/SessionsPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { VerifyEmailPage } from './pages/VerifyEmailPage.jsx';

/**
 * auth-web 루트.
 *
 * Routes:
 *  - /login           → LoginPage (이미 로그인이면 redirect — Issue #295)
 *  - /signup          → SignupPage (이미 로그인이면 redirect — Issue #295)
 *  - /forgot-password → ForgotPasswordPage (Issue #221)
 *  - /reset-password  → ResetPasswordPage  (Issue #221)
 *  - /verify-email    → VerifyEmailPage    (Issue #226)
 *  - /profile         → ProfilePage        (Issue #235)
 *  - /delete-account  → DeleteAccountPage  (Issue #231)
 *  - /sessions        → SessionsPage       (Issue #321)
 *  - /                → /login redirect
 *  - 그 외             → /login redirect
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
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/delete-account" element={<DeleteAccountPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthLayout>
  );
};
