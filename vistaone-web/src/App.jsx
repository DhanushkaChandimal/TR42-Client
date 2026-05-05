import "./styles/forms.css";
import { Route, Routes, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import WorkOrders from "./pages/WorkOrders";
import Wells from "./pages/Wells";
import Vendors from "./pages/Vendors";
import VendorMarketplace from "./pages/VendorMarketplace";
import VendorFavorites from "./pages/VendorFavorites";
import VendorDetail from "./pages/VendorDetail";
import Contracts from "./pages/Contracts";
import Invoices from "./pages/Invoices";
import Tickets from "./pages/Tickets";
import Analytics from "./pages/Analytics";
import Fraud from "./pages/Fraud";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleProtectedRoute from "./routes/RoleProtectedRoute";
import PermissionRoute from "./routes/PermissionRoute";
import AccessDenied from "./pages/AccessDenied";
import RegisterUser from "./pages/RegisterUser";
import RegisterClient from "./pages/RegisterClient";
import VerifyEmail from "./pages/VerifyEmail";
import UserManagement from "./pages/UserManagement";
import RoleManagement from "./pages/RoleManagement";
import Profile from "./pages/UserProfile";
import Messages from "./pages/Messages";

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<RegisterUser />} />
            <Route path="/register-client" element={<RegisterClient />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
                path="/dashboard"
                element={
                    <PermissionRoute resource="dashboard">
                        <Dashboard />
                    </PermissionRoute>
                }
            />
            <Route
                path="/workorders"
                element={
                    <PermissionRoute resource="workorders">
                        <WorkOrders />
                    </PermissionRoute>
                }
            />
            <Route
                path="/wells"
                element={
                    <PermissionRoute resource="wells">
                        <Wells />
                    </PermissionRoute>
                }
            />
            <Route
                path="/vendors"
                element={
                    <PermissionRoute resource="vendors">
                        <Vendors />
                    </PermissionRoute>
                }
            />
            <Route
                path="/vendor-marketplace"
                element={
                    <PermissionRoute resource="vendor_marketplace">
                        <VendorMarketplace />
                    </PermissionRoute>
                }
            />
            <Route
                path="/vendor-favorites"
                element={
                    <PermissionRoute resource="vendors">
                        <VendorFavorites />
                    </PermissionRoute>
                }
            />
            <Route
                path="/vendors/:vendorId"
                element={
                    <PermissionRoute resource="vendors">
                        <VendorDetail />
                    </PermissionRoute>
                }
            />
            <Route
                path="/contracts"
                element={
                    <PermissionRoute resource="contracts">
                        <Contracts />
                    </PermissionRoute>
                }
            />
            <Route
                path="/invoices"
                element={
                    <PermissionRoute resource="invoices">
                        <Invoices />
                    </PermissionRoute>
                }
            />
            <Route
                path="/admin/users"
                element={
                    <RoleProtectedRoute roles={["MASTER", "ADMIN"]}>
                        <UserManagement />
                    </RoleProtectedRoute>
                }
            />
            <Route
                path="/admin/roles"
                element={
                    <RoleProtectedRoute roles={["MASTER"]}>
                        <RoleManagement />
                    </RoleProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                }
            />

            <Route
                 path="/tickets"
                 element={
                    <PermissionRoute resource="workorders">
                       <Tickets />
                    </PermissionRoute>
                  }
              />

              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
                  
              <Route
                path="/fraud"
                element={
                  <ProtectedRoute>
                    <Fraud />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/messages"
                element={
                  <PermissionRoute resource="workorders">
                    <Messages />
                  </PermissionRoute>
                }
              />
                  
              <Route path="/access-denied" element={<AccessDenied />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
    );
}

export default App;
