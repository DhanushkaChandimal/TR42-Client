import "./styles/forms.css";
import { Route, Routes, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import WorkOrders from "./pages/WorkOrders";
import Wells from "./pages/Wells";
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workorders"
        element={
          <ProtectedRoute>
            <WorkOrders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wells"
        element={
          <ProtectedRoute>
            <Wells />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendors"
        element={
          <ProtectedRoute>
            <Vendors />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendors/:vendorId"
        element={
          <ProtectedRoute>
            <VendorDetail />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
