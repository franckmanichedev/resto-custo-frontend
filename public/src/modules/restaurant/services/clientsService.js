import { api } from '../../../shared/api/apiClient.js';

export const clientsService = {
    getAll: (params = {}) => api.restaurant.clients.getAll(params),
    getById: (id) => api.restaurant.clients.getById(id),
    create: (payload) => api.restaurant.clients.create(payload),
    update: (id, payload) => api.restaurant.clients.update(id, payload),
    remove: (id) => api.restaurant.clients.delete(id)
};
