import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthLayout } from './components/AuthLayout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';

/**
 * auth-web 루트.
 * Routes:
 *  - /login   → LoginPage
 *  - /signup  → SignupPage
 *  - /        → /login redirect
 *  - 그 외    → /login redirect
 */
export const App = () => {
  return (
    <AuthLayout>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthLayout>
  );
};
