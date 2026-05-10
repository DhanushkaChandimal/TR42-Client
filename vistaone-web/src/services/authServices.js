import { API_BASE } from "../config/api";
import { safeFetch } from "./apiClient";

const CLIENTS_ENDPOINT = `${API_BASE}/clients`;
const LOGIN_ENDPOINT = `${API_BASE}/users/login`;
const REGISTER_ENDPOINT = `${API_BASE}/users/register`;
const VERIFY_EMAIL_ENDPOINT = `${API_BASE}/users/verify-email`;
const REGISTER_CLIENT_ENDPOINT = `${API_BASE}/clients/register`;
const ME_ENDPOINT = `${API_BASE}/users/me`;
const ADMIN_USERS_ENDPOINT = `${API_BASE}/admin/users`;
const ADMIN_ROLES_ENDPOINT = `${API_BASE}/admin/roles`;
const MASTER_TRANSFER_ENDPOINT = `${API_BASE}/admin/master/transfer`;
const CLIENT_SETTINGS_ENDPOINT = `${API_BASE}/clients/settings`;
const PROFILE_ENDPOINT = `${API_BASE}/users/profile/`;

function authHeader() {
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
    }
    if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
    return data;
}

export const authService = {
    login: async ({ identifier, password }) => {
        const res = await safeFetch(LOGIN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Invalid email or password.');
        return data;
    },

    register: async (formData) => {
        const address = {
            street: formData.street || "",
            city: formData.city || "",
            state: formData.state || "",
            zip: formData.zip || "",
            country: formData.country || "",
        };
        const payload = {};
        Object.entries(formData).forEach(([key, value]) => {
            if (value !== null && value !== undefined && !['confirmPassword', 'street', 'city', 'state', 'zip', 'country'].includes(key)) {
                payload[key] = value;
            }
        });
        payload.address = address;
        const res = await safeFetch(REGISTER_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return await handleResponse(res);
    },

    registerClient: async ({ company, adminUser }) => {
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
            company_phone: company.company_phone,
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
        if (company.company_web_address) payload.company_web_address = company.company_web_address;
        const res = await safeFetch(REGISTER_CLIENT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return await handleResponse(res);
    },

    getMe: async () => {
        const res = await safeFetch(ME_ENDPOINT, { headers: authHeader() });
        return handleResponse(res);
    },

    verifyEmail: async (token) => {
        try {
            const res = await safeFetch(`${VERIFY_EMAIL_ENDPOINT}?token=${token}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) return { success: false, message: payload?.message || 'Verification failed.' };
            return { success: true, message: payload.message };
        } catch (err) {
            return { success: false, message: err?.message || 'Verification failed. Please try again.' };
        }
    },

    // ── Admin: User Management ───────────────────────────────────────────────
    getUsers: async () => {
        const res = await safeFetch(ADMIN_USERS_ENDPOINT, { headers: authHeader() });
        return handleResponse(res);
    },

    getPendingUsers: async () => {
        const res = await safeFetch(`${ADMIN_USERS_ENDPOINT}/pending`, { headers: authHeader() });
        return handleResponse(res);
    },

    approveUser: async (userId) => {
        const res = await safeFetch(`${ADMIN_USERS_ENDPOINT}/${userId}/approve`, {
            method: 'POST',
            headers: authHeader(),
        });
        return handleResponse(res);
    },

    rejectUser: async (userId) => {
        const res = await safeFetch(`${ADMIN_USERS_ENDPOINT}/${userId}/reject`, {
            method: 'POST',
            headers: authHeader(),
        });
        return handleResponse(res);
    },

    updateUser: async (userId, data) => {
        const res = await safeFetch(`${ADMIN_USERS_ENDPOINT}/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    setUserRoles: async (userId, roles) => {
        const res = await safeFetch(`${ADMIN_USERS_ENDPOINT}/${userId}/roles`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ roles }),
        });
        return handleResponse(res);
    },

    transferMaster: async (targetUserId) => {
        const res = await safeFetch(MASTER_TRANSFER_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ target_user_id: targetUserId }),
        });
        return handleResponse(res);
    },

    // ── Admin: Roles ─────────────────────────────────────────────────────────
    getRoles: async () => {
        const res = await safeFetch(ADMIN_ROLES_ENDPOINT, { headers: authHeader() });
        return handleResponse(res);
    },

    createRole: async ({ name, description }) => {
        const res = await safeFetch(ADMIN_ROLES_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ name, description }),
        });
        return handleResponse(res);
    },

    updateRole: async (roleId, { name, description }) => {
        const res = await safeFetch(`${ADMIN_ROLES_ENDPOINT}/${roleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ name, description }),
        });
        return handleResponse(res);
    },

    deleteRole: async (roleId, migrateToRoleId = null) => {
        const res = await safeFetch(`${ADMIN_ROLES_ENDPOINT}/${roleId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify(migrateToRoleId ? { migrate_to_role_id: migrateToRoleId } : {}),
        });
        return handleResponse(res);
    },

    getRolePermissions: async (roleId) => {
        const res = await safeFetch(`${ADMIN_ROLES_ENDPOINT}/${roleId}/permissions`, { headers: authHeader() });
        return handleResponse(res);
    },

    setRolePermissions: async (roleId, permissions) => {
        const res = await safeFetch(`${ADMIN_ROLES_ENDPOINT}/${roleId}/permissions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ permissions }),
        });
        return handleResponse(res);
    },

    // ── Public: Client list (for registration dropdown) ──────────────────────
    getClients: async () => {
        const res = await safeFetch(CLIENTS_ENDPOINT);
        return handleResponse(res);
    },

    // ── Client Settings ───────────────────────────────────────────────────────
    getClientSettings: async () => {
        const res = await safeFetch(CLIENT_SETTINGS_ENDPOINT, { headers: authHeader() });
        return handleResponse(res);
    },

    updateClientSettings: async (settings) => {
        const res = await safeFetch(CLIENT_SETTINGS_ENDPOINT, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify(settings),
        });
        return handleResponse(res);
    },

    getProfile: async () => {
        const res = await safeFetch(PROFILE_ENDPOINT, { headers: authHeader() });
        return handleResponse(res);
    },

    updateProfile: async (data) => {
        const res = await safeFetch(PROFILE_ENDPOINT, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },

    changePassword: async (data) => {
        const res = await safeFetch(`${PROFILE_ENDPOINT}change-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify(data),
        });
        return handleResponse(res);
    },
};
