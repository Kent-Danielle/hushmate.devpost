import { Navigate, Route, Routes } from 'react-router';
import PublicOnly from './auth/PublicOnly';
import RequireAuth from './auth/RequireAuth';
import { AppShell } from './components/TabBar';
import Landing from './screens/Landing';
import SignIn from './screens/SignIn';
import SignUp from './screens/SignUp';
import JoinByLink from './screens/JoinByLink';
import HouseStep from './screens/onboarding/HouseStep';
import SetupPlaceholder from './screens/onboarding/SetupPlaceholder';
import SchedulePage from './screens/schedule/SchedulePage';
import SummaryPage from './screens/summary/SummaryPage';
import HousesPage from './screens/houses/HousesPage';
import ProfilePage from './screens/profile/ProfilePage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/signin" element={<SignIn />} />
      </Route>
      <Route path="/join/:inviteToken" element={<JoinByLink />} />
      <Route element={<RequireAuth />}>
        {/* Onboarding and its setup steps have no tab bar. */}
        <Route path="/onboarding" element={<HouseStep />} />
        <Route path="/onboarding/setup/:houseId" element={<SetupPlaceholder />} />
        <Route element={<AppShell />}>
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/houses" element={<HousesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
