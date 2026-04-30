import { api } from '../../../shared/api/apiClient.js';

export const compositionsService = {
    getAll: (params = {}) => api.restaurant.compositions.getAll(params),
    getById: (id) => api.restaurant.compositions.getById(id),
    create: (payload) => api.restaurant.compositions.create(payload),
    update: (id, payload) => api.restaurant.compositions.update(id, payload),
    remove: (id) => api.restaurant.compositions.delete(id)
};
