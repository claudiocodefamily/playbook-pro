import { createBrowserRouter } from 'react-router';
import { GuestOnly, RequireAuth } from './auth/RequireAuth';
import { PlaybooksPage } from './features/playbooks/PlaybooksPage';
import { PlaybookPage } from './features/plays/PlaybookPage';
import { EditorPage } from './features/editor/EditorPage';
import { GlossaryPage } from './features/glossary/GlossaryPage';
import { RosterPage } from './features/roster/RosterPage';
import { CoachesPage } from './features/team/CoachesPage';
import { TeamsPage } from './features/teams/TeamsPage';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';
import { SharedPlaybookPage } from './features/shared/SharedPlaybookPage';
import { JoinPage } from './features/join/JoinPage';
import { GamePlanPage } from './features/game-plans/GamePlanPage';
import { GamePlansPage } from './features/game-plans/GamePlansPage';
import { QuizPage } from './features/quizzes/QuizPage';
import { QuizTakePage } from './features/quizzes/QuizTakePage';
import { QuizzesPage } from './features/quizzes/QuizzesPage';

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
  // Público: lo abre cualquiera con el link, sin cuenta.
  { path: '/shared/:token', element: <SharedPlaybookPage /> },
  // Invitación de un jugador: se ve sin sesión; para aceptarla hay que entrar.
  { path: '/join/:token', element: <JoinPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <TeamsPage /> },
      { path: 'teams/:teamId', element: <PlaybooksPage /> },
      { path: 'teams/:teamId/roster', element: <RosterPage /> },
      { path: 'teams/:teamId/glossary', element: <GlossaryPage /> },
      { path: 'teams/:teamId/coaches', element: <CoachesPage /> },
      { path: 'teams/:teamId/game-plans', element: <GamePlansPage /> },
      { path: 'teams/:teamId/game-plans/:planId', element: <GamePlanPage /> },
      { path: 'teams/:teamId/quizzes', element: <QuizzesPage /> },
      { path: 'teams/:teamId/quizzes/:quizId', element: <QuizPage /> },
      { path: 'teams/:teamId/quizzes/:quizId/play', element: <QuizTakePage /> },
      { path: 'teams/:teamId/playbooks/:playbookId', element: <PlaybookPage /> },
      { path: 'teams/:teamId/plays/:playId', element: <EditorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
