const LOGIN_ENDPOINT = "/api/users/login";
const REGISTER_ENDPOINT = "/api/users/register";
const VERIFY_EMAIL_ENDPOINT = "/api/users/verify-email";
const REGISTER_CLIENT_ENDPOINT = "/api/clients/register";
const PROFILE_ENDPOINT = "/users/profile/";

export const authService = {
    login: async ({ email, password }) => {
        try {
            const response = await fetch(LOGIN_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            let payload = {};
            try {
                payload = await response.json();
            } catch (e) {
                console.warn("Response is not JSON", e);
            }

            if (!response.ok) {
                throw new Error(
                    payload?.message || "Invalid email or password.",
                );
            }

            return payload;
        } catch (err) {
            if (err instanceof TypeError) {
                throw new Error(
                    "Unable to reach server. Please try again later.",
                );
            }
            throw err;
        }
    },

    register: async (formData) => {
        try {
            const address = {
                street: formData.street || "",
                city: formData.city || "",
                state: formData.state || "",
                zip: formData.zip || "",
                country: formData.country || "",
            };

            const payload = {};
            Object.entries(formData).forEach(([key, value]) => {
                if (
                    value !== null &&
                    value !== undefined &&
                    key !== "confirmPassword" &&
                    key !== "street" &&
                    key !== "city" &&
                    key !== "state" &&
                    key !== "zip" &&
                    key !== "country"
                ) {
                    payload[key] = value;
                }
            });
            payload.address = address;
            const response = await fetch(REGISTER_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            let respPayload = {};
            try {
                respPayload = await response.json();
            } catch (e) {
                console.warn("Response is not JSON", e);
            }
            if (!response.ok) {
                throw new Error(respPayload?.message || "Registration failed");
            }
            return respPayload;
        } catch (err) {
            if (err instanceof TypeError) {
                throw new Error(
                    "Unable to reach server. Please try again later.",
                );
            }
            throw err;
        }
    },

    registerClient: async ({ company, adminUser }) => {
        try {
            const address = {
                street: company.street || "",
                city: company.city || "",
                state: company.state || "",
                zip: company.zip || "",
                country: company.country || "",
            };

            const payload = {
                client_name: company.client_name,
                client_code: company.client_code,
                primary_contact_name: company.primary_contact_name,
                company_email: company.company_email,
                company_contact_number: company.company_contact_number,
                address,
                admin_user: {
                    username: adminUser.username,
                    email: adminUser.email,
                    password: adminUser.password,
                    first_name: adminUser.first_name,
                    last_name: adminUser.last_name,
                    contact_number: adminUser.contact_number,
                },
            };

            if (company.company_web_address) {
                payload.company_web_address = company.company_web_address;
            }

            const response = await fetch(REGISTER_CLIENT_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const respPayload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(respPayload?.message || "Registration failed");
            }

            return respPayload;
        } catch (err) {
            if (err instanceof TypeError) {
                throw new Error(
                    "Unable to reach server. Please try again later.",
                );
            }
            throw err;
        }
    },

    verifyEmail: async (token) => {
        try {
            const response = await fetch(
                `${VERIFY_EMAIL_ENDPOINT}?token=${token}`,
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                return {
                    success: false,
                    message: payload?.message || "Verification failed.",
                };
            }
            return { success: true, message: payload.message };
        } catch (err) {
            if (err instanceof Error) {
                return { success: false, message: err.message };
            }
            return {
                success: false,
                message: "Unable to reach server. Please try again later.",
            };
        }
    },

    getProfile: async () => {
        const res = await fetch(PROFILE_ENDPOINT, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
        });
        let data = {};
        try {
            data = await res.json();
        } catch (e) {
            console.warn("Response is not JSON", e);
        }

        if (!res.ok) {
            throw new Error(data.error || "Failed to fetch profile");
        }

        return data;
    },

    updateProfile: async (data) => {
        const res = await fetch(PROFILE_ENDPOINT, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify(data),
        });
        let result = {};
        try {
            result = await res.json();
        } catch (e) {
            console.warn("Response is not JSON", e);
        }

        if (!res.ok) {
            throw new Error(result.error || "Update failed");
        }

        return result;
    },
    changePassword: async (data) => {
        const res = await fetch(PROFILE_ENDPOINT + "change-password", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify(data),
        });

        let result = {};
        try {
            result = await res.json();
        } catch {
            // response may not be JSON
        }

        if (!res.ok) {
            throw new Error(result.error || "Password change failed");
        }

        return result;
    },
};
