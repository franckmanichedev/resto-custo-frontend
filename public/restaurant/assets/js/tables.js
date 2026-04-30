// tables.js
(function () {
    let editingTableId = null;
    function renderTables() {
        const tables = getData(STORAGE_KEYS.tables);
        const container = document.getElementById('tablesList');
        container.innerHTML = `
        <table class="w-full">
            <thead>
                <tr>
                    <th>Numéro</th>
                    <th>Nom</th>
                    <th>Statut</th>
                    <th>QR Code</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${tables.map(t => `
                    <tr>
                        <td>${t.number}</td>
                        <td>${t.name}</td>
                        <td><span class="px-2 py-1 rounded-full text-xs ${t.status === 'free' ? 'bg-green-100 text-green-800' : t.status === 'occupied' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">${t.status === 'free' ? 'Libre' : t.status === 'occupied' ? 'Occupée' : 'Réservée'}</span></td>
                        <td><code>${t.qrCode || '-'}</code></td>
                        <td><button class="edit-table btn-secondary text-sm" data-id="${t.id}"><i class="fas fa-edit"></i></button> <button class="delete-table btn-secondary text-sm" data-id="${t.id}"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
        attachEvents();
    }
    function attachEvents() {
        document.querySelectorAll('.edit-table').forEach(btn => btn.addEventListener('click', () => editTable(btn.dataset.id)));
        document.querySelectorAll('.delete-table').forEach(btn => btn.addEventListener('click', () => deleteTable(btn.dataset.id)));
    }
    function openModal(table = null) {
        editingTableId = table?.id || null;
        document.getElementById('tableNumber').value = table?.number || '';
        document.getElementById('tableName').value = table?.name || '';
        document.getElementById('tableStatus').value = table?.status || 'free';
        document.getElementById('tableModal').classList.add('open');
    }
    function closeModal() { document.getElementById('tableModal').classList.remove('open'); editingTableId = null; }
    function saveTable(e) {
        e.preventDefault();
        const tables = getData(STORAGE_KEYS.tables);
        const newTable = {
            id: editingTableId || Date.now().toString(),
            number: document.getElementById('tableNumber').value,
            name: document.getElementById('tableName').value,
            status: document.getElementById('tableStatus').value,
            qrCode: editingTableId ? tables.find(t => t.id === editingTableId)?.qrCode : `qr-${Date.now()}`
        };
        if (editingTableId) {
            const index = tables.findIndex(t => t.id === editingTableId);
            if (index !== -1) tables[index] = newTable;
        } else tables.push(newTable);
        saveData(STORAGE_KEYS.tables, tables);
        showToast(editingTableId ? 'Table modifiée' : 'Table ajoutée', 'success');
        closeModal();
        renderTables();
    }
    function editTable(id) { const tables = getData(STORAGE_KEYS.tables); const table = tables.find(t => t.id === id); if (table) openModal(table); }
    function deleteTable(id) { if (confirm('Supprimer cette table ?')) { let tables = getData(STORAGE_KEYS.tables); tables = tables.filter(t => t.id !== id); saveData(STORAGE_KEYS.tables, tables); showToast('Table supprimée', 'warning'); renderTables(); } }
    document.getElementById('addTableBtn')?.addEventListener('click', () => openModal());
    document.getElementById('closeTableModal')?.addEventListener('click', closeModal);
    document.getElementById('tableForm')?.addEventListener('submit', saveTable);
    renderTables();
})();