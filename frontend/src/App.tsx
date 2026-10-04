import { Navigate, Route, Routes } from 'react-router';
import Landing from './screens/Landing';

// Slice 1: only the public landing page. /signup, /signin and the signed-in routes arrive later.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
