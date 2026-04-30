import { api } from '../../../shared/api/apiClient.js';

export const ordersService = {
    getAll: (params = {}) => api.restaurant.orders.getAll(params),
    getById: (id) => api.restaurant.orders.getById(id),
    updateStatus: (id, status) => api.restaurant.orders.updateStatus(id, status)
};
