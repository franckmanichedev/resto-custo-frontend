import { api } from '../../../shared/api/apiClient.js';

export const dashboardService = {
    async loadSnapshot() {
        const [ordersResponse, platsResponse, tablesResponse] = await Promise.all([
            api.orders.getAll(),
            api.plats.getAll(),
            api.tables.getAll()
        ]);

        const orders = ordersResponse.data || [];
        const plats = platsResponse.data || [];
        const tables = tablesResponse.data || [];
        const today = new Date().toISOString().split('T')[0];

        return {
            orders,
            recentOrders: orders.slice(0, 5),
            stats: {
                todayOrders: orders.filter((order) => order.createdAt?.startsWith(today)).length,
                pendingOrders: orders.filter((order) => order.status === 'pending').length,
                availablePlats: plats.filter((plat) => plat.is_available).length,
                activeTables: tables.filter((table) => table.is_active).length
            }
        };
    }
};
