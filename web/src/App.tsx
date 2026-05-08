import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MailboxPage } from './pages/MailboxPage';
import { MessageViewPage } from './pages/MessageViewPage';
import { ComposePage } from './pages/ComposePage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminDepartmentsPage } from './pages/AdminDepartmentsPage';
import { AdminPositionsPage } from './pages/AdminPositionsPage';
import { ProfilePage } from './pages/ProfilePage';

export function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-slate-500">Yuklanmoqda...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/inbox" replace />} />
          <Route path="/inbox" element={<MailboxPage folder="inbox" />} />
          <Route path="/sent" element={<MailboxPage folder="sent" />} />
          <Route path="/starred" element={<MailboxPage folder="inbox" starredOnly />} />
          <Route path="/trash" element={<MailboxPage folder="trash" />} />
          <Route path="/archive" element={<MailboxPage folder="archive" />} />
          <Route path="/messages/:id" element={<MessageViewPage />} />
          <Route path="/compose" element={<ComposePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
          <Route path="/admin/positions" element={<AdminPositionsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}
