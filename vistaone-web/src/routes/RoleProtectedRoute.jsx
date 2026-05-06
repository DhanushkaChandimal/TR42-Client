import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';

export default function RoleProtectedRoute({ children, roles = [] }) {
    const { token, user } = useAuthContext();

    if (!token) return <Navigate to="/login" replace />;

    const userRoles = (user?.roles || []).map((r) => r.toUpperCase());
    const hasAccess = roles.length === 0 || roles.some((r) => userRoles.includes(r.toUpperCase()));

    if (!hasAccess) return <Navigate to="/access-denied" replace />;

    return children;
}
