import { api } from '../../../shared/api/apiClient.js';

export const platsService = {
    getAll: (params = {}) => api.plats.getAll(params),
    getById: (id) => api.plats.getById(id),
    create: (payload) => api.plats.create(payload),
    update: (id, payload) => api.plats.update(id, payload),
    remove: (id) => api.plats.delete(id),
    toggleAvailability: (id) => api.plats.toggleAvailability(id)
};
