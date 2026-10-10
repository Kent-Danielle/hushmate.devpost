import { Navigate, Route, Routes } from 'react-router';
import PublicOnly from './auth/PublicOnly';
import RequireAuth from './auth/RequireAuth';
import { AppShell } from './components/TabBar';
import Landing from './screens/Landing';
import SignIn from './screens/SignIn';
import SignUp from './screens/SignUp';
import JoinByLink from './screens/JoinByLink';
import DemoSignIn from './screens/DemoSignIn';
import HouseStep from './screens/onboarding/HouseStep';
import SetupFlow from './screens/onboarding/SetupFlow';
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
      {/* Outside PublicOnly: a signed-in visitor is signed out here, not redirected away. */}
      <Route path="/demo" element={<DemoSignIn />} />
      <Route element={<RequireAuth />}>
        {/* Onboarding and its setup steps have no tab bar. */}
        <Route path="/onboarding" element={<HouseStep />} />
        <Route path="/onboarding/setup/:houseId" element={<SetupFlow />} />
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
