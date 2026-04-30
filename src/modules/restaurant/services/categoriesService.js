import { api } from '../../../shared/api/apiClient.js';

export const categoriesService = {
    getAll: (params = {}) => api.restaurant.categories.getAll(params),
    getById: (id) => api.restaurant.categories.getById(id),
    create: (payload) => api.restaurant.categories.create(payload),
    update: (id, payload) => api.restaurant.categories.update(id, payload),
    remove: (id) => api.restaurant.categories.delete(id),
    getTypes: (categoryId) => api.restaurant.categories.getTypes(categoryId),
    getAllTypes: (params = {}) => api.restaurant.categories.getAllTypes(params),
    createType: (payload) => api.restaurant.categories.createType(payload),
    updateType: (id, payload) => api.restaurant.categories.updateType(id, payload),
    removeType: (id) => api.restaurant.categories.deleteType(id)
};
