// App.jsx - the root component that sets up routing and auth
import "./styles/forms.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import Dashboard from "./pages/Dashboard/Dashboard";
import Sidebar from "./layouts/Sidebar/Sidebar";
import { sidebarNav } from "./data/dashboardData";

function App() {
  return (
    // AuthProvider wraps everything so any component can access auth state
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* public routes - anyone can see these */}
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* protected route - sidebar + dashboard, only for logged in users */}
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
