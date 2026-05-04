import { api } from '../../../shared/api/apiClient.js';

export const tablesService = {
    getAll: (params = {}) => api.restaurant.tables.getAll(params),
    getById: (id) => api.restaurant.tables.getById(id),
    create: (payload) => api.restaurant.tables.create(payload),
    update: (id, payload) => api.restaurant.tables.update(id, payload),
    remove: (id) => api.restaurant.tables.delete(id),
    getClientMenuUrl(table) {
        return `/client/loading.html?table=${encodeURIComponent(table.id)}`;
    }
};
