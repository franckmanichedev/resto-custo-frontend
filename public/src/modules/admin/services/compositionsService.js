import { api } from '../../../shared/api/apiClient.js';

export const compositionsService = {
    getAll: (params = {}) => api.compositions.getAll(params),
    create: (payload) => api.compositions.create(payload),
    remove: (id) => api.compositions.delete(id)
};
