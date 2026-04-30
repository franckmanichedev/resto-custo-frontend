// dashboard-page.js
import { initSidebar } from '../components/Sidebar.js';
import { showToast } from '../utils/toast.js';
import { dashboardService } from '../../services/dashboardService.js';

async function loadStats() {
  const stats = await dashboardService.getStats();
  document.getElementById('stats-today-orders-orders').innerText = stats.todayOrders;
  document.getElementById('stats-pending').innerText = stats.pendingOrders;
  document.getElementById('stats-revenue').innerText = stats.revenue.toLocaleString() + ' FCFA';
  document.getElementById('stats-rating').innerText = stats.avgRating;
}

function initChart() {
  const ctx = document.getElementById('salesChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: { labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], datasets: [{ label: 'Ventes (FCFA)', data: [12000, 19000, 15000, 22000, 28000, 32000, 25000], borderColor: '#f97316', tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
  });
}

initSidebar();
loadStats();
initChart();