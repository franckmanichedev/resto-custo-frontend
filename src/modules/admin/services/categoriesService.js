import { api } from '../../../shared/api/apiClient.js';

export const categoriesService = {
    getAll: (params = {}) => api.categories.getAll(params),
    getById: (id) => api.categories.getById(id),
    create: (payload) => api.categories.create(payload),
    update: (id, payload) => api.categories.update(id, payload),
    remove: (id) => api.categories.delete(id),
    getTypes: (categoryId) => api.categories.getTypes(categoryId),
    getAllTypes: (params = {}) => api.categories.getAllTypes(params),
    createType: (payload) => api.categories.createType(payload),
    updateType: (id, payload) => api.categories.updateType(id, payload),
    removeType: (id) => api.categories.deleteType(id)
};
