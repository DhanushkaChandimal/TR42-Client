

import { authFetch } from './apiClient';
const WORKORDER_ENDPOINT = '/workorders';

export const workOrderService = {

  getAll: async () => {    
    const response = await authFetch(WORKORDER_ENDPOINT, {
      method: 'GET',
    });


    if (!response.ok) {
      throw new Error('Failed to fetch work orders');
    }

    return await response.json();
  },

  getById: async (id) => {
    const response = await authFetch(`${WORKORDER_ENDPOINT}/${id}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch work order');
    }

    return await response.json();
  },

  create: async (data) => {
    const response = await authFetch(WORKORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create work order');
    }

    return await response.json();
  },

  update: async (id, data) => {
    const response = await authFetch(`${WORKORDER_ENDPOINT}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update work order');
    }

    return await response.json();
  },

  remove: async (id) => {
    const response = await authFetch(`${WORKORDER_ENDPOINT}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete work order');
    }
    
    return await response.json();
  },
};