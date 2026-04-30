// dashboard.js
(function() {
    function updateStats() {
        const commandes = getData(STORAGE_KEYS.commandes);
        const plats = getData(STORAGE_KEYS.plats);
        const tables = getData(STORAGE_KEYS.tables);
        
        const today = new Date().toISOString().split('T')[0];
        const todayOrders = commandes.filter(c => c.createdAt?.startsWith(today));
        const totalOrders = commandes.length;
        const pendingOrders = commandes.filter(c => c.status === 'pending').length;
        const revenue = commandes.reduce((sum, c) => sum + (c.items.reduce((s,i) => s + (i.price * i.quantity), 0)), 0);
        
        const statsGrid = document.getElementById('statsGrid');
        statsGrid.innerHTML = `
            <div class="stat-card"><div class="stat-title">CA aujourd'hui</div><div class="stat-value">${revenue.toLocaleString()} FCFA</div><div class="stat-change">+12% vs hier</div></div>
            <div class="stat-card"><div class="stat-title">Commandes</div><div class="stat-value">${todayOrders.length}</div><div class="stat-change">Total: ${totalOrders}</div></div>
            <div class="stat-card"><div class="stat-title">En attente</div><div class="stat-value">${pendingOrders}</div><div class="stat-change">${pendingOrders > 0 ? 'À traiter' : 'Aucune'}</div></div>
            <div class="stat-card"><div class="stat-title">Note moyenne</div><div class="stat-value">4.8 ★</div><div class="stat-change">Sur 56 avis</div></div>
        `;
        updatePendingBadge();
    }

    function renderChart() {
        const chartDiv = document.getElementById('weeklyChart');
        const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const heights = [65, 80, 45, 90, 70, 85, 60];
        chartDiv.innerHTML = days.map((day, i) => `<div class="chart-bar" style="height: ${heights[i]}px;"><span>${day}</span></div>`).join('');
    }

    function renderRecentOrders() {
        const commandes = getData(STORAGE_KEYS.commandes);
        const recent = [...commandes].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,5);
        const container = document.getElementById('recentOrdersList');
        container.innerHTML = recent.map(c => `
            <div class="flex justify-between items-center p-2 border-b">
                <div><span class="font-semibold">Table ${c.tableNumber}</span><span class="text-xs text-gray-500 ml-2">${new Date(c.createdAt).toLocaleTimeString()}</span></div>
                <span class="text-sm">${c.items.reduce((s,i)=>s+i.quantity,0)} articles</span>
            </div>
        `).join('');
    }

    function renderPopularTables() {
        const tables = getData(STORAGE_KEYS.tables);
        const container = document.getElementById('popularTablesList');
        container.innerHTML = tables.map(t => `
            <div class="flex justify-between items-center p-2 border-b"><span>${t.name}</span><span class="text-xs ${t.status === 'occupied' ? 'text-red-500' : 'text-green-500'}">${t.status === 'occupied' ? 'Occupée' : 'Libre'}</span></div>
        `).join('');
    }

    function init() {
        updateStats();
        renderChart();
        renderRecentOrders();
        renderPopularTables();
    }
    init();
    // Rafraîchir toutes les 30 secondes (optionnel)
    setInterval(() => {
        updateStats();
        renderRecentOrders();
    }, 30000);
})();