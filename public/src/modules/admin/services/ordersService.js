import { api } from '../../../shared/api/apiClient.js';

export const ordersService = {
    getAll: (params = {}) => api.orders.getAll(params),
    getById: (id) => api.orders.getById(id),
    updateStatus: (id, status) => api.orders.updateStatus(id, status)
};
