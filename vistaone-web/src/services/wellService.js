import { authFetch } from './apiClient';

const WELL_ENDPOINT = '/wells';

async function parseError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || fallback);
}

export async function getWells() {
  const res = await authFetch(WELL_ENDPOINT, { method: 'GET' });
  if (!res.ok) await parseError(res, 'Failed to fetch wells');
  return await res.json();
}

export async function createWell(data) {
  const res = await authFetch(WELL_ENDPOINT + '/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, 'Failed to create well');
  return await res.json();
}

export async function updateWell(id, data) {
  const res = await authFetch(`${WELL_ENDPOINT}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) await parseError(res, 'Failed to update well');
  return await res.json();
}

export async function deleteWell(id) {
  const res = await authFetch(`${WELL_ENDPOINT}/${id}`, { method: 'DELETE' });
  if (!res.ok) await parseError(res, 'Failed to delete well');
  return await res.json();
}
