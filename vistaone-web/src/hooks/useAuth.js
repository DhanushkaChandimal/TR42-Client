import { useCallback, useState } from 'react';
import { authService } from '../services/authServices';
import { useAuthContext } from '../context/AuthContext';

export const useAuth = () => {
    const { setAuth, clearAuth } = useAuthContext();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const login = useCallback(async ({ identifier, password }) => {
        setIsLoading(true);
        setError('');

        try {
            const response = await authService.login({ identifier, password });

            if (response?.token) {
                localStorage.setItem('authToken', response.token);
                const profile = await authService.getMe();
                setAuth(response.token, profile);
            }

            return response;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [setAuth]);

    const clearError = useCallback(() => {
        setError('');
    }, []);

    const logout = useCallback(() => {
        clearAuth();
        setError('');
    }, [clearAuth]);

    return {
        isLoading,
        error,
        login,
        logout,
        clearError,
    };
};
