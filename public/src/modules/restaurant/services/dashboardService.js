import { api } from '../../../shared/api/apiClient.js';

export const dashboardService = {
    async loadSnapshot() {
        const [ordersResponse, platsResponse, tablesResponse] = await Promise.all([
            api.restaurant.orders.getAll(),
            api.restaurant.plats.getAll(),
            api.restaurant.tables.getAll()
        ]);

        const orders = ordersResponse.data || [];
        const plats = platsResponse.data || [];
        const tables = tablesResponse.data || [];
        const today = new Date().toISOString().split('T')[0];

        const sortedOrders = [...orders].sort((left, right) =>
            new Date(right.createdAt || right.created_at || 0).getTime()
            - new Date(left.createdAt || left.created_at || 0).getTime()
        );

        return {
            orders,
            recentOrders: sortedOrders.slice(0, 5),
            stats: {
                todayOrders: orders.filter((order) => (order.createdAt || order.created_at || '').startsWith(today)).length,
                pendingOrders: orders.filter((order) => order.status === 'pending').length,
                availablePlats: plats.filter((plat) => plat.is_available !== false).length,
                activeTables: tables.filter((table) => table.is_active !== false).length
            }
        };
    }
};
