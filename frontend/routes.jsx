import { Navigate, Route, Routes } from 'react-router-dom';
import EditChallengePage from './app/challenges/[id]/edit/page';
import ChallengeDetailPage from './app/challenges/[id]/page';
import ChallengesPage from './app/challenges/page';
import PrivateChallengesPage from './app/challenges/private/page';
import ForbiddenPage from './app/forbidden/page';
import LoginPage from './app/login/page';
import MatchSettingDetailPage from './app/match-settings/[id]/page';
import NewMatchSettingPage from './app/match-settings/new/page';
import MatchSettingsPage from './app/match-settings/page';
import NewChallengePage from './app/new-challenge/page';
import NotFoundRoute from './app/not-found/page';
import HomePage from './app/page';
import ChallengeLayout from './app/student/challenges/[challengeId]/layout';
import MatchPage from './app/student/challenges/[challengeId]/match/page';
import PeerReviewPage from './app/student/challenges/[challengeId]/peer-review/page';
import StudentChallengeResultPage from './app/student/challenges/[challengeId]/result/page';
import StudentChallengesPage from './app/student/challenges/page';
import StudentLeaderboardPage from './app/student/leaderboard/page';
import ProfilePage from './app/student/page';
import RewardsRulesPage from './app/student/rewards/page';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<HomePage />} />
      <Route path='/login' element={<LoginPage />} />
      <Route path='/forbidden' element={<ForbiddenPage />} />
      <Route path='/not-found' element={<NotFoundRoute />} />

      <Route path='/challenges' element={<ChallengesPage />} />
      <Route path='/challenges/private' element={<PrivateChallengesPage />} />
      <Route path='/challenges/:id' element={<ChallengeDetailPage />} />
      <Route path='/challenges/:id/edit' element={<EditChallengePage />} />

      <Route path='/match-settings' element={<MatchSettingsPage />} />
      <Route path='/match-settings/new' element={<NewMatchSettingPage />} />
      <Route path='/match-settings/:id' element={<MatchSettingDetailPage />} />

      <Route path='/new-challenge' element={<NewChallengePage />} />

      <Route path='/student' element={<ProfilePage />} />
      <Route path='/student/challenges' element={<StudentChallengesPage />} />
      <Route
        path='/student/challenges/:challengeId'
        element={<ChallengeLayout />}
      >
        <Route index element={<Navigate to='match' replace />} />
        <Route path='match' element={<MatchPage />} />
        <Route path='peer-review' element={<PeerReviewPage />} />
        <Route path='result' element={<StudentChallengeResultPage />} />
      </Route>
      <Route path='/student/leaderboard' element={<StudentLeaderboardPage />} />
      <Route path='/student/rewards' element={<RewardsRulesPage />} />

      <Route path='*' element={<NotFoundRoute />} />
    </Routes>
  );
}
