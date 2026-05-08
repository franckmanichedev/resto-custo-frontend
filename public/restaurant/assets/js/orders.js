// orders.js
(function() {
    const statusMap = {
        pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
        preparing: { label: 'En préparation', color: 'bg-blue-100 text-blue-800' },
        ready: { label: 'Prêt', color: 'bg-green-100 text-green-800' },
        served: { label: 'Servi', color: 'bg-gray-100 text-gray-200' }
    };
    const statusOrder = ['pending', 'preparing', 'ready', 'served'];

    function renderKanban() {
        const commandes = getData(STORAGE_KEYS.commandes);
        const board = document.getElementById('kanbanBoard');
        board.innerHTML = '';
        for (const status of statusOrder) {
            const column = document.createElement('div');
            column.className = 'kanban-column';
            column.innerHTML = `<div class="kanban-header">${statusMap[status].label}</div><div class="kanban-cards" data-status="${status}"></div>`;
            const cardsContainer = column.querySelector('.kanban-cards');
            const filtered = commandes.filter(c => c.status === status);
            filtered.forEach(cmd => {
                const card = document.createElement('div');
                card.className = 'kanban-card';
                card.innerHTML = `
                    <div class="order-id">#${cmd.id.slice(0,8)}</div>
                    <div class="order-table">Table ${cmd.tableNumber}</div>
                    <div class="order-items">${cmd.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</div>
                    <div class="order-status-badge ${statusMap[cmd.status].color}">${statusMap[cmd.status].label}</div>
                    <div class="status-actions">
                        ${statusOrder.indexOf(cmd.status) < statusOrder.length - 1 ? `<button class="status-btn" data-id="${cmd.id}" data-next="${statusOrder[statusOrder.indexOf(cmd.status)+1]}">Avancer</button>` : ''}
                        ${cmd.status !== 'served' ? `<button class="status-btn" data-id="${cmd.id}" data-cancel="true">Annuler</button>` : ''}
                    </div>
                `;
                cardsContainer.appendChild(card);
            });
            board.appendChild(column);
        }
        attachEvents();
    }

    function attachEvents() {
        document.querySelectorAll('.status-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                const commandes = getData(STORAGE_KEYS.commandes);
                const index = commandes.findIndex(c => c.id === id);
                if (index !== -1) {
                    if (btn.dataset.next) {
                        commandes[index].status = btn.dataset.next;
                        saveData(STORAGE_KEYS.commandes, commandes);
                        showToast(`Commande passée à ${statusMap[btn.dataset.next].label}`, 'success');
                    } else if (btn.dataset.cancel) {
                        commandes[index].status = 'cancelled';
                        saveData(STORAGE_KEYS.commandes, commandes);
                        showToast('Commande annulée', 'warning');
                    }
                    renderKanban();
                    updatePendingBadge();
                }
            });
        });
    }

    function init() {
        renderKanban();
        // Recherche (optionnelle)
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const cards = document.querySelectorAll('.kanban-card');
                cards.forEach(card => {
                    const text = card.innerText.toLowerCase();
                    card.style.display = text.includes(query) ? 'block' : 'none';
                });
            });
        }
        // Realtime updates via Socket.io
        (async () => {
            try {
                if (!window.io) {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = '/socket.io/socket.io.js';
                        s.async = true;
                        s.onload = () => resolve();
                        s.onerror = (e) => reject(e);
                        document.head.appendChild(s);
                    });
                }
                if (!window.io) return;
                const socket = io();
                socket.on('new_order', () => {
                    renderKanban();
                    updatePendingBadge && updatePendingBadge();
                });
                socket.on('order_status_changed', () => {
                    renderKanban();
                    updatePendingBadge && updatePendingBadge();
                });
            } catch (err) {
                // fallback to periodic render if sockets unavailable
                setInterval(renderKanban, 10000);
            }
        })();
    }
    init();
})();