const LOGIN_ENDPOINT = '/api/users/login';

export const authService = {
    login: async ({ email, password }) => {
        const response = await fetch(LOGIN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(payload?.message || 'Invalid email or password.');
        }

        return payload;
    },
};
