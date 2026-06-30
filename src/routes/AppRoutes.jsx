import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import RuleLibrary from "../pages/RuleLibrary";
import { useAppSelector } from "../app/hooks";
import CaseManagement from "../pages/caseManagement";
import Security from "../pages/Security";
import AIRuleArchitect from "../pages/AIRuleArchitect";
import MyConnections from "../pages/MyConnections";
import Schedules from "../pages/Schedules";

const ProtectedRoute = ({ children }) => {
  const user = useAppSelector((state) => state.auth.user);
  return user ? children : <Navigate to="/login" />;
};

const RoleRoute = ({ children, roles }) => {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rules"
          element={
            <ProtectedRoute>
              <RuleLibrary />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cases"
          element={
            <ProtectedRoute>
              <CaseManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/security"
          element={
            <ProtectedRoute>
              <Security />
            </ProtectedRoute>
          }
        />


        <Route
          path="/architect"
          element={
            <ProtectedRoute>
              <AIRuleArchitect />
            </ProtectedRoute>
          }
        />

        <Route
          path="/schedules"
          element={
            <RoleRoute roles={["Admin", "Analyst"]}>
              <Schedules />
            </RoleRoute>
          }
        />

        <Route
          path="/servers"
          element={
            <ProtectedRoute>
              <MyConnections />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}