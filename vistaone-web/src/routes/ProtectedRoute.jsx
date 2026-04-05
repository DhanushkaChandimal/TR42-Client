import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const VERIFY_TOKEN_ENDPOINT = '/api/users/verify-token';

export default function ProtectedRoute({ children }) {
    const token = localStorage.getItem('authToken');
    const [isValid, setIsValid] = useState(token ? null : false);

    useEffect(() => {
        if (!token) return;

        const verifyToken = async () => {
            try {
                const res = await fetch(VERIFY_TOKEN_ENDPOINT, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                });

                setIsValid(res.ok);
            } catch {
                setIsValid(false);
            }
        };

        verifyToken();
    }, [token]);

    if (isValid === null) {
        return <div>Checking authentication...</div>;
    }
    if (!isValid) {
        return <Navigate to="/login" replace />;
    }
    return children;
}
