// App.jsx - teammate's login + our dashboard and protected routes
import "./styles/forms.css";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";

// teammate's login from main
import Login from "./components/Login";

// our pages
import Register from "./pages/Register/Register";
import Dashboard from "./pages/Dashboard/Dashboard";
import Sidebar from "./layouts/Sidebar/Sidebar";
import { sidebarNav } from "./data/dashboardData";

function App() {
  return (
    <Routes>
      {/* public routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* protected route - teammate's login saves token, our dashboard shows after */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <div className="app-layout">
              <Sidebar navData={sidebarNav} />
              <Dashboard />
            </div>
          </ProtectedRoute>
        }
      />

      {/* catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
