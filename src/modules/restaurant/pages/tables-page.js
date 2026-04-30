import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, confirmDialog, escapeHtml } from '../../../shared/utils/index.js';
import { authService } from '../services/authService.js';
import { tablesService } from '../services/tablesService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Accès administrateur requis');
}

let editingTableId = null;
let tablesCache = [];
let tableLayout = localStorage.getItem('restaurantTablesLayout') || 'list';

const tablesList = document.getElementById('tables-list');
const refreshBtn = document.getElementById('refresh-tables');
const summaryEl = document.getElementById('tables-summary');
const layoutButtons = document.querySelectorAll('[data-table-layout]');

// Modal elements
const modal = document.getElementById('tableModal');
const modalTitle = document.getElementById('modalTitle');
const form = document.getElementById('table-form-modal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const addBtn = document.getElementById('add-table-btn');

function openModal() {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
    resetForm();
}

function resetForm() {
    editingTableId = null;
    modalTitle.textContent = 'Nouvelle table';
    form.reset();
    document.getElementById('modal-table-active').checked = true;
    document.getElementById('modal-table-qr-code').value = '';
}

function setModalData(table) {
    editingTableId = table.id;
    modalTitle.textContent = `Modifier: ${table.name || table.number}`;
    document.getElementById('modal-table-name').value = table.name || '';
    document.getElementById('modal-table-number').value = table.number || '';
    document.getElementById('modal-table-qr-code').value = table.qr_code || '';
    document.getElementById('modal-table-active').checked = table.is_active !== false;
}

async function loadTables() {
    showTablesSkeleton();
    try {
        const response = await tablesService.getAll();
        tablesCache = response.data || [];
        renderTables(tablesCache);
        renderSummary(tablesCache);
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        tablesList.innerHTML = '<div class="text-center py-8 text-red-500">Erreur de chargement</div>';
    }
}

function showTablesSkeleton() {
    if (!tablesList) return;
    tablesList.className = 'space-y-3';
    tablesList.innerHTML = `
        <div class="space-y-3">
            ${[1, 2, 3, 4].map(() => `
                <div class="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
                    <div class="flex items-center gap-4">
                        <div class="skeleton h-20 w-20 rounded-xl"></div>
                        <div>
                            <div class="skeleton mb-2 h-5 w-36"></div>
                            <div class="skeleton h-4 w-24"></div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <div class="skeleton h-9 w-9 rounded-lg"></div>
                        <div class="skeleton h-9 w-9 rounded-lg"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderSummary(tables) {
    if (!summaryEl) return;
    const counts = tables.reduce((acc, table) => {
        const status = getTableStatus(table).key;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    summaryEl.innerHTML = `
        <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">${tables.length} table(s)</span>
        <span class="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">${counts.free || 0} libre(s)</span>
        <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">${counts.occupied || 0} occupée(s)</span>
        <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">${counts.reserved || 0} réservée(s)</span>
    `;
}

function renderTables(tables) {
    applyLayoutButtons();
    if (!tables.length) {
        tablesList.className = '';
        tablesList.innerHTML = '<div class="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center text-gray-500">Aucune table trouvée</div>';
        return;
    }
    tablesList.className = tableLayout === 'plan'
        ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'
        : 'space-y-3';
    tablesList.innerHTML = tables.map((table) => (
        tableLayout === 'plan' ? renderPlanTable(table) : renderListTable(table)
    )).join('');

    document.querySelectorAll('.edit-table').forEach((btn) => {
        btn.addEventListener('click', () => editTable(btn.dataset.id));
    });
    document.querySelectorAll('.delete-table').forEach((btn) => {
        btn.addEventListener('click', () => deleteTable(btn.dataset.id));
    });
}

function renderListTable(table) {
    const status = getTableStatus(table);
    const menuUrl = table.menu_url || tablesService.getClientMenuUrl(table);
    return `
        <article class="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md md:flex-row md:items-center">
            <div class="flex items-center gap-4">
                ${renderQrPreview(table, 'h-24 w-24')}
                <div>
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-lg font-bold text-gray-900">${escapeHtml(table.name || `Table ${table.number || ''}`)}</h3>
                        <span class="rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}">${escapeHtml(status.label)}</span>
                    </div>
                    <p class="mt-1 text-sm text-gray-500">Numéro: <strong>${escapeHtml(table.number || '-')}</strong></p>
                    <p class="mt-2 max-w-2xl break-all text-xs text-gray-400">QR: ${escapeHtml(table.qr_code || 'Généré auto')}</p>
                    <a href="${escapeHtml(menuUrl)}" target="_blank" class="mt-1 inline-flex max-w-2xl break-all text-xs font-medium text-primary hover:underline">${escapeHtml(menuUrl)}</a>
                </div>
            </div>
            <div class="flex gap-2 md:ml-auto">
                <button class="edit-table inline-flex h-10 w-10 items-center justify-center rounded-xl text-primary hover:bg-yellow-100" data-id="${escapeHtml(table.id)}" aria-label="Modifier"><i class="fas fa-edit"></i></button>
                <button class="delete-table inline-flex h-10 w-10 items-center justify-center rounded-xl text-red-500 hover:bg-red-50" data-id="${escapeHtml(table.id)}" aria-label="Supprimer"><i class="fas fa-trash-alt"></i></button>
            </div>
        </article>
    `;
}

function renderPlanTable(table) {
    const status = getTableStatus(table);
    return `
        <article class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Table</p>
                    <h3 class="mt-1 text-2xl font-bold text-gray-900">${escapeHtml(table.number || '-')}</h3>
                    <p class="mt-1 text-sm text-gray-500">${escapeHtml(table.name || 'Sans nom')}</p>
                </div>
                <span class="rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}">${escapeHtml(status.label)}</span>
            </div>
            <div class="mt-4 flex items-end justify-between gap-4">
                ${renderQrPreview(table, 'h-20 w-20')}
                <div class="flex gap-2">
                    <button class="edit-table inline-flex h-9 w-9 items-center justify-center rounded-xl text-primary hover:bg-yellow-100" data-id="${escapeHtml(table.id)}" aria-label="Modifier"><i class="fas fa-edit"></i></button>
                    <button class="delete-table inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-50" data-id="${escapeHtml(table.id)}" aria-label="Supprimer"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        </article>
    `;
}

function renderQrPreview(table, sizeClass) {
    const qrValue = table.qr_code || table.menu_url || tablesService.getClientMenuUrl(table);
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(qrValue)}`;
    return `<div class="${sizeClass} shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-1"><img src="${escapeHtml(src)}" alt="QR code" class="h-full w-full object-contain" loading="lazy"></div>`;
}

function getTableStatus(table) {
    const rawStatus = String(table.status || table.table_status || table.occupation_status || '').trim().toLowerCase();
    if (table.is_active === false || rawStatus === 'inactive') return { key: 'inactive', label: 'Inactive', className: 'bg-gray-100 text-gray-600' };
    if (table.is_reserved || table.reserved || ['reserved', 'reservee'].includes(rawStatus)) return { key: 'reserved', label: 'Réservée', className: 'bg-amber-100 text-amber-700' };
    if (table.is_occupied || table.occupied || table.current_session_id || table.active_session_id || ['occupied', 'occupee'].includes(rawStatus)) return { key: 'occupied', label: 'Occupée', className: 'bg-blue-100 text-blue-700' };
    return { key: 'free', label: 'Libre', className: 'bg-green-100 text-green-700' };
}

function applyLayoutButtons() {
    layoutButtons.forEach((button) => {
        const isActive = button.dataset.tableLayout === tableLayout;
        button.classList.toggle('bg-gray-900', isActive);
        button.classList.toggle('text-white', isActive);
        button.classList.toggle('border-gray-900', isActive);
        button.classList.toggle('bg-white', !isActive);
        button.classList.toggle('text-gray-600', !isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

async function editTable(id) {
    try {
        const response = await tablesService.getById(id);
        const table = response.data;
        setModalData(table);
        openModal();
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
    }
}

async function deleteTable(id) {
    const confirmed = await confirmDialog('Supprimer cette table ?', 'Confirmation');
    if (!confirmed) return;
    try {
        await tablesService.remove(id);
        showToast('Table supprimée', 'success');
        if (editingTableId === id) resetForm();
        await loadTables();
    } catch (error) {
        showToast(error.message || 'Erreur de suppression', 'error');
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('modal-table-name').value.trim(),
        number: document.getElementById('modal-table-number').value.trim(),
        qr_code: document.getElementById('modal-table-qr-code').value.trim() || undefined,
        is_active: document.getElementById('modal-table-active').checked
    };
    if (!payload.name || !payload.number) {
        showToast('Le nom et le numéro sont requis', 'warning');
        return;
    }
    try {
        if (editingTableId) {
            await tablesService.update(editingTableId, payload);
            showToast('Table modifiée', 'success');
        } else {
            await tablesService.create(payload);
            showToast('Table créée', 'success');
        }
        closeModal();
        await loadTables();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
});

addBtn.addEventListener('click', () => {
    resetForm();
    openModal();
});
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

layoutButtons.forEach((button) => {
    button.addEventListener('click', () => {
        tableLayout = button.dataset.tableLayout || 'list';
        localStorage.setItem('restaurantTablesLayout', tableLayout);
        renderTables(tablesCache);
    });
});
refreshBtn?.addEventListener('click', loadTables);

applyLayoutButtons();
await loadTables();