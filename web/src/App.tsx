import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/Layout';
import { LayoutEdo } from './components/layouts/LayoutEdo';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MailboxPage } from './pages/MailboxPage';
import { MessageViewPage } from './pages/MessageViewPage';
import { ComposePage } from './pages/ComposePage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { ContactGroupsPage } from './pages/ContactGroupsPage';
import { AdminDepartmentsPage } from './pages/AdminDepartmentsPage';
import { AdminPositionsPage } from './pages/AdminPositionsPage';
import { ProfilePage } from './pages/ProfilePage';
import { EdoHomePage } from './pages/edo/EdoHomePage';
import { EdoComposePage } from './pages/edo/EdoComposePage';
import { EdoDocumentViewPage } from './pages/edo/EdoDocumentViewPage';
import { EdoTemplatesPage } from './pages/edo/EdoTemplatesPage';
import { EdoReportsPage } from './pages/edo/EdoReportsPage';
import { EdoStatsPage } from './pages/edo/EdoStatsPage';
import { EdoHisobotlarPage } from './pages/edo/EdoHisobotlarPage';
import { EdoChatPage } from './pages/edo/EdoChatPage';
import { EdoApprovalPage } from './pages/edo/EdoApprovalPage';
import { EdoCalendarPage } from './pages/edo/EdoCalendarPage';
import { EdoSearchPage } from './pages/edo/EdoSearchPage';
import {
  EdoMyDocsPage,
  EdoDraftsPage,
  EdoTasksPage,
  EdoIncomingPage,
  EdoOutgoingPage,
  EdoArchivePage,
  EdoToSignPage,
  EdoControlPage,
  EdoDepartmentPage,
} from './pages/edo/EdoDocList';

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
      <Route path="/register" element={<Navigate to="/login" replace />} />
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
          <Route path="/contact-groups" element={<ContactGroupsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
          <Route path="/admin/positions" element={<AdminPositionsPage />} />
        </Route>
        <Route path="/edo" element={<LayoutEdo />}>
          <Route index element={<EdoHomePage />} />
          <Route path="home" element={<EdoHomePage />} />
          <Route path="calendar" element={<EdoCalendarPage />} />
          <Route path="chat" element={<EdoChatPage />} />
          <Route path="mine" element={<EdoMyDocsPage />} />
          <Route path="search" element={<EdoSearchPage />} />
          <Route path="control" element={<EdoControlPage />} />
          <Route path="department" element={<EdoDepartmentPage />} />
          <Route path="approval" element={<EdoApprovalPage />} />
          <Route path="compose" element={<EdoComposePage />} />
          <Route path="tasks" element={<EdoTasksPage />} />
          <Route path="drafts" element={<EdoDraftsPage />} />
          <Route path="documents/:id" element={<EdoDocumentViewPage />} />
          <Route path="incoming" element={<EdoIncomingPage />} />
          <Route path="outgoing" element={<EdoOutgoingPage />} />
          <Route path="archive" element={<EdoArchivePage />} />
          <Route path="signing" element={<EdoToSignPage />} />
          <Route path="templates" element={<EdoTemplatesPage />} />
          <Route path="stats" element={<EdoStatsPage />} />
          <Route path="stats/:view" element={<EdoStatsPage />} />
          <Route path="reports" element={<EdoReportsPage />} />
          <Route path="hisobotlar" element={<EdoHisobotlarPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}
