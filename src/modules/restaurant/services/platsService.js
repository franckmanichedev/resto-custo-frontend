import { api } from '../../../shared/api/apiClient.js';

export const platsService = {
    getAll: (params = {}) => api.restaurant.plats.getAll(params),
    getById: (id) => api.restaurant.plats.getById(id),
    create: (payload) => api.restaurant.plats.create(payload),
    update: (id, payload) => api.restaurant.plats.update(id, payload),
    remove: (id) => api.restaurant.plats.delete(id),
    toggleAvailability: (id) => api.restaurant.plats.toggleAvailability(id)
};
