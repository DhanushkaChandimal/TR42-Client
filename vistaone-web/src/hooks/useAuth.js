import { useCallback, useState } from 'react';
import { authService } from '../services/authServices';

export const useAuth = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const login = useCallback(async ({ email, password }) => {
        setIsLoading(true);
        setError('');

        try {
            const response = await authService.login({ email, password });

            if (response?.token) {
                localStorage.setItem('authToken', response.token);
            }

            return response;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError('');
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        setError('');
    }, []);

    return {
        isLoading,
        error,
        login,
        logout,
        clearError,
    };
};
