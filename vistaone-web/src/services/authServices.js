const LOGIN_ENDPOINT = '/api/users/login';
const REGISTER_ENDPOINT = '/api/users/register';

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

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.message || 'Invalid email or password.');
            }

            return payload;

        } catch (err) {
            console.error(err);
            throw new Error('Unable to reach server. Please try again later.');
        }
    },

    register: async (formData) => {
        try {
            // Build address object
            const address = {
                street: formData.street || "",
                city: formData.city || "",
                state: formData.state || "",
                zip: formData.zip || "",
                country: formData.country || ""
            };

            const payload = {};
            Object.entries(formData).forEach(([key, value]) => {
                if (
                    value !== null &&
                    value !== undefined &&
                    key !== 'confirmPassword' &&
                    key !== 'street' &&
                    key !== 'city' &&
                    key !== 'state' &&
                    key !== 'zip' &&
                    key !== 'country'
                ) {
                    payload[key] = value;
                }
            });
            payload.address = address;
            const response = await fetch(REGISTER_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const respPayload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(respPayload?.message || 'Registration failed');
            }
            return respPayload;
        } catch (err) {
            console.error(err);
            throw new Error('Unable to reach server. Please try again later.');
        }
    },
};
