// frontend\src\App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LoginSystem from "./components/views/LoginSystem";
import ModusManagement from "./components/views/ModusManagement";
import MobileUnitManagement from "./components/views/MobileUnitManagement";
import CrimeDashboard from "./components/views/CrimeDashboard";
import EBlotter from "./components/views/EBlotter";
import CaseManagement from "./components/views/CaseManagement";
import CrimeMapping from "./components/views/CrimeMapping";
import UserManagement from "./components/views/UserManagement";
import ProfileSettings from "./components/views/ProfileSettings";
import VerificationSuccess from "./components/views/VerificationSucess";
import ProtectedRoute from "./components/ProtectedRoute";
import PageLayout from "./components/layout/PageLayout.jsx";
import AuditLog from "./components/views/AuditLog";
import Overview from "./components/views/Overview";
import TypeOfOperationManagement from "./components/views/TypeOfOperationManagement";


function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginSystem />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/verification-success" element={<VerificationSuccess />} />

        {/* Full-screen Overview — deliberately OUTSIDE <PageLayout> so the
            Sidebar and TopBar never mount for this route. Still protected
            by the same auth check as everything else. */}
        <Route
          path="/overview"
          element={
            <ProtectedRoute>
              <Overview />
            </ProtectedRoute>
          }
        />

        {/* Protected Layout */}
        <Route
          element={
            <ProtectedRoute>
              <PageLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/crime-dashboard" element={<CrimeDashboard />} />
          <Route path="/e-blotter" element={<EBlotter />} />
          <Route path="/case-management" element={<CaseManagement />} />
          <Route path="/crime-mapping" element={<CrimeMapping />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/profile" element={<ProfileSettings />} />
          <Route path="/modus-management" element={<ModusManagement />} />
          <Route path="/mobile-unit-management" element={<MobileUnitManagement />} />
          <Route path="/type-of-operation-management" element={<TypeOfOperationManagement />} />
          <Route path="/audit-log" element={<AuditLog />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;