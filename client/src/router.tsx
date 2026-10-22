import { createBrowserRouter } from 'react-router';
import { GuestOnly, RequireAuth } from './auth/RequireAuth';
import { PlaybooksPage } from './features/playbooks/PlaybooksPage';
import { PlaybookPage } from './features/plays/PlaybookPage';
import { EditorPage } from './features/editor/EditorPage';
import { TeamsPage } from './features/teams/TeamsPage';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestOnly>
        <RegisterPage />
      </GuestOnly>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <TeamsPage /> },
      { path: 'teams/:teamId', element: <PlaybooksPage /> },
      { path: 'teams/:teamId/playbooks/:playbookId', element: <PlaybookPage /> },
      { path: 'teams/:teamId/plays/:playId', element: <EditorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
