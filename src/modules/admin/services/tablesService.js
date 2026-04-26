import { api } from '../../../shared/api/apiClient.js';

export const tablesService = {
    getAll: (params = {}) => api.tables.getAll(params),
    getById: (id) => api.tables.getById(id),
    create: (payload) => api.tables.create(payload),
    update: (id, payload) => api.tables.update(id, payload),
    remove: (id) => api.tables.delete(id),
    getClientMenuUrl(table) {
        return `/client/index.html?table=${encodeURIComponent(table.id)}`;
    }
};
