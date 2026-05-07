import { authFetch } from './apiClient';

const WORKORDER_ENDPOINT = '/workorders';

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export const workOrderService = {

  summary: async ({ q = '' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString();
    const url = qs ? `${WORKORDER_ENDPOINT}/summary?${qs}` : `${WORKORDER_ENDPOINT}/summary`;
    const response = await authFetch(url, { method: 'GET' });
    if (!response.ok) await parseError(response, 'Failed to fetch work order summary');
    return await response.json();
  },

  getAll: async () => {
    const response = await authFetch(WORKORDER_ENDPOINT, { method: 'GET' });
    if (!response.ok) await parseError(response, 'Failed to fetch work orders');
    return await response.json();
  },

  search: async ({ q = '', status = '', page = 1, per_page = 10, sort_by = 'created_at', order = 'desc' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('per_page', String(per_page));
    params.set('sort_by', sort_by);
    params.set('order', order);
    const response = await authFetch(`${WORKORDER_ENDPOINT}/search?${params.toString()}`, { method: 'GET' });
    if (!response.ok) await parseError(response, 'Failed to search work orders');
    return await response.json();
  },

  getById: async (id) => {
    const response = await authFetch(`${WORKORDER_ENDPOINT}/${id}`, { method: 'GET' });
    if (!response.ok) await parseError(response, 'Failed to fetch work order');
    return await response.json();
  },

  create: async (data) => {
    const response = await authFetch(WORKORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) await parseError(response, 'Failed to create work order');
    return await response.json();
  },

  update: async (id, data) => {
    const response = await authFetch(`${WORKORDER_ENDPOINT}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!response.ok) await parseError(response, 'Failed to update work order');
    return await response.json();
  },

  remove: async (id, cancellation_reason = 'Cancelled before assignment') => {
    const response = await authFetch(`${WORKORDER_ENDPOINT}/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ cancellation_reason }),
    });
    if (!response.ok) await parseError(response, 'Failed to delete work order');
    return await response.json();
  },
};
