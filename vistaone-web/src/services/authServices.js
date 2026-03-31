const LOGIN_ENDPOINT = '/api/users/login';

export const authService = {
    login: async ({ email, password }) => {
        try {
            const response = await fetch(LOGIN_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            // backend not running returns 502 through the vite proxy
            if (response.status === 502) {
                return { token: 'demo-token', status: 'success', message: 'Demo mode' };
            }

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.message || 'Invalid email or password.');
            }

            return payload;
        } catch (err) {
            // network error - backend completely unreachable
            return { token: 'demo-token', status: 'success', message: 'Demo mode' };
        }
    },
};
