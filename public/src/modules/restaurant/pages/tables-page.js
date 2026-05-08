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
const tableForm = document.getElementById('table-form');
const formTitle = document.getElementById('form-title');
const cancelEdit = document.getElementById('cancel-edit');
const summaryEl = document.getElementById('tables-summary');
const layoutButtons = document.querySelectorAll('[data-table-layout]');

function applyLayoutButtons() {
    layoutButtons.forEach((button) => {
        const isActive = button.dataset.tableLayout === tableLayout;
        button.className = isActive 
            ? "rounded-lg bg-white px-3 py-1 text-xs font-bold text-gray-800 shadow-sm border border-gray-200/40 transition-all flex items-center justify-center gap-1.5"
            : "rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-800 px-3 py-1 transition-all flex items-center justify-center gap-1.5";
            
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = button.dataset.tableLayout === 'list' 
                ? `fas fa-list text-[11px] ${isActive ? 'text-orange-500' : 'text-gray-400'}`
                : `fas fa-border-all text-[11px] ${isActive ? 'text-orange-500' : 'text-gray-400'}`;
        }
        button.setAttribute('aria-pressed', String(isActive));
    });
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
        if (tablesList) tablesList.innerHTML = '<div class="text-center py-12 text-sm font-semibold text-red-500">Erreur de chargement des tables</div>';
    }
}

function showTablesSkeleton() {
    if (!tablesList) return;
    tablesList.className = 'space-y-3';
    tablesList.innerHTML = `
        <div class="space-y-3">
            ${[1, 2, 3, 4].map(() => `
                <div class="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 opacity-70">
                    <div class="flex items-center gap-4">
                        <div class="skeleton h-20 w-20"></div>
                        <div class="space-y-2">
                            <div class="skeleton h-5 w-36"></div>
                            <div class="skeleton h-4 w-24"></div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <div class="skeleton h-9 w-9"></div>
                        <div class="skeleton h-9 w-9"></div>
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
        <span class="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-xs font-bold text-gray-600 border border-gray-200/50">${tables.length} Table(s)</span>
        <span class="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">${counts.free || 0} Libre(s)</span>
        <span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">${counts.occupied || 0} Occupée(s)</span>
        <span class="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">${counts.reserved || 0} Réservée(s)</span>
    `;
}

function renderTables(tables) {
    applyLayoutButtons();
    if (!tables.length) {
        if (tablesList) {
            tablesList.className = '';
            tablesList.innerHTML = `
                <div class="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center text-sm font-semibold text-gray-400">
                    <i class="fas fa-folder-open text-2xl block mb-2 text-gray-300"></i> Aucune table trouvée
                </div>`;
        }
        return;
    }
    if (tablesList) {
        tablesList.className = tableLayout === 'plan' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3';
        tablesList.innerHTML = tables.map((table) => (tableLayout === 'plan' ? renderPlanTable(table) : renderListTable(table))).join('');
    }
    
    document.querySelectorAll('.edit-table').forEach((button) => {
        button.addEventListener('click', () => editTable(button.dataset.id));
    });
    document.querySelectorAll('.delete-table').forEach((button) => {
        button.addEventListener('click', () => deleteTable(button.dataset.id));
    });
}

function renderListTable(table) {
    const status = getTableStatus(table);
    const menuUrl = table.menu_url || tablesService.getClientMenuUrl(table);
    return `
        <article class="group flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200 md:flex-row md:items-center justify-between">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center flex-1 min-w-0">
                <div class="relative flex-shrink-0 mx-auto sm:mx-0 p-1.5 bg-gray-50 rounded-xl ring-1 ring-gray-100">
                    ${renderQrPreview(table, 'h-20 w-20 md:h-24 md:w-24')}
                </div>
                <div class="space-y-1.5 flex-1 min-w-0 text-center sm:text-left">
                    <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h3 class="text-lg font-bold tracking-tight text-gray-900 truncate">
                            ${escapeHtml(table.name || `Table ${table.number || ''}`)}
                        </h3>
                        <span class="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold shadow-sm uppercase tracking-wide border ${status.className}">
                            ${escapeHtml(status.label)}
                        </span>
                    </div>
                    <p class="text-sm font-medium text-gray-500">
                        Numéro : <span class="font-bold text-gray-900">${escapeHtml(table.number || '-')}</span>
                    </p>
                    <div class="pt-0.5 flex flex-col gap-1 text-xs">
                        <a href="${escapeHtml(menuUrl)}" target="_blank" class="inline-flex items-center justify-center sm:justify-start gap-1.5 font-semibold text-orange-600 hover:text-orange-700 hover:underline group/link">
                            <i class="fas fa-external-link-alt text-[10px] text-orange-500 transition-transform group-hover/link:translate-x-0.5"></i>
                            Ouvrir le menu en ligne
                        </a>
                        <p class="font-mono text-[10px] text-gray-400 truncate max-w-md mx-auto sm:mx-0" title="${escapeHtml(table.qr_code)}">
                            ID QR: ${escapeHtml(table.qr_code || 'Généré automatiquement')}
                        </p>
                    </div>
                </div>
            </div>
            <div class="flex items-center justify-center gap-2 border-t border-gray-50 pt-3 md:pt-0 md:border-0 md:ml-6 flex-shrink-0">
                <button class="inline-flex h-9 px-3 items-center justify-center rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm">
                    <i class="fas fa-print mr-1.5 text-gray-400"></i> Imprimer
                </button>
                <button class="edit-table inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-gray-500 hover:bg-gray-100 hover:text-orange-600 transition-all" data-id="${escapeHtml(table.id)}" aria-label="Modifier table">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-table inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-red-400 hover:bg-red-50 hover:text-red-600 transition-all" data-id="${escapeHtml(table.id)}" aria-label="Supprimer table">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </article>
    `;
}

function renderPlanTable(table) {
    const status = getTableStatus(table);
    return `
        <article class="group relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-gray-200">
            <div class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                    <span class="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Table</span>
                    <h3 class="text-3xl font-extrabold tracking-tight text-gray-900">${escapeHtml(table.number || '-')}</h3>
                    <p class="text-sm font-medium text-gray-500">${escapeHtml(table.name || 'Sans nom')}</p>
                </div>
                <div class="flex flex-col items-end gap-3">
                    <span class="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold shadow-sm uppercase border ${status.className}">
                        ${escapeHtml(status.label)}
                    </span>
                    <div class="flex gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                        <button class="edit-table inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-orange-600 transition-colors" data-id="${escapeHtml(table.id)}" aria-label="Modifier table"><i class="fas fa-edit text-sm"></i></button>
                        <button class="delete-table inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" data-id="${escapeHtml(table.id)}" aria-label="Supprimer table"><i class="fas fa-trash-alt text-sm"></i></button>
                    </div>
                </div>
            </div>
            <div class="my-3 border-t border-gray-100"></div>
            <div class="flex flex-col gap-3 bg-gray-50/50 -mx-4 -mb-4 p-3 rounded-b-2xl border-t border-gray-100">
                <div class="flex items-center gap-3">
                    <div class="p-1 bg-white rounded-lg shadow-sm ring-1 ring-gray-200/50">
                        ${renderQrPreview(table, 'h-12 w-12')}
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-900">Menu QR Code</p>
                        <p class="text-[11px] font-medium text-gray-500">Scannable par les clients</p>
                    </div>
                </div>
                <button class="inline-flex w-full items-center justify-center h-9 px-4 rounded-xl text-xs font-bold bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-all active:scale-[0.98]">
                    <i class="fas fa-print mr-2 text-gray-400 group-hover:text-gray-600"></i> Imprimer le QR Code
                </button>
            </div>
        </article>
    `;
}

function renderQrPreview(table, sizeClass) {
    const qrValue = table.qr_code || table.menu_url || tablesService.getClientMenuUrl(table);
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(qrValue)}`;
    return `
        <div class="${sizeClass} shrink-0 overflow-hidden rounded-lg border border-gray-200/50 bg-white p-1">
            <img src="${escapeHtml(src)}" alt="QR code table ${escapeHtml(table.number || table.name || '')}" class="h-full w-full object-contain" loading="lazy">
        </div>
    `;
}

function getTableStatus(table) {
    const rawStatus = String(table.status || table.table_status || table.occupation_status || '').trim().toLowerCase();
    if (table.is_active === false || rawStatus === 'inactive') {
        return { key: 'inactive', label: 'Inactive', className: 'bg-gray-100 text-gray-600 border-gray-200' };
    }
    if (table.is_reserved || table.reserved || ['reserved', 'reservee'].includes(rawStatus)) {
        return { key: 'reserved', label: 'Réservée', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (table.is_occupied || table.occupied || table.current_session_id || table.active_session_id || ['occupied', 'occupee'].includes(rawStatus)) {
        return { key: 'occupied', label: 'Occupée', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    return { key: 'free', label: 'Libre', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

async function editTable(id) {
    try {
        const response = await tablesService.getById(id);
        const table = response.data;
        editingTableId = table.id;
        if (formTitle) formTitle.textContent = `Modifier : ${table.name}`;
        document.getElementById('table-name').value = table.name || '';
        document.getElementById('table-number').value = table.number || '';
        document.getElementById('table-qr-code').value = table.qr_code || '';
        document.getElementById('table-active').checked = table.is_active !== false;
        cancelEdit?.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
    }
}

async function deleteTable(id) {
    const confirmed = await confirmDialog('Supprimer définitivement cette table ?', 'Confirmation');
    if (!confirmed) return;
    try {
        await tablesService.remove(id);
        showToast('Table supprimée', 'success');
        if (editingTableId === id) {
            resetForm();
        }
        await loadTables();
    } catch (error) {
        showToast(error.message || 'Erreur de suppression', 'error');
    }
}

function resetForm() {
    editingTableId = null;
    if (formTitle) formTitle.textContent = 'Nouvelle table';
    tableForm?.reset();
    const activeCheck = document.getElementById('table-active');
    if (activeCheck) activeCheck.checked = true;
    cancelEdit?.classList.add('hidden');
}

tableForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
        name: document.getElementById('table-name').value.trim(),
        number: document.getElementById('table-number').value.trim(),
        qr_code: document.getElementById('table-qr-code').value.trim() || undefined,
        is_active: document.getElementById('table-active').checked
    };

    if (!payload.name || !payload.number) {
        showToast('Le nom et le numéro sont requis', 'warning');
        return;
    }

    try {
        if (editingTableId) {
            await tablesService.update(editingTableId, payload);
            showToast('Table modifiée avec succès', 'success');
        } else {
            await tablesService.create(payload);
            showToast('Table créée avec succès', 'success');
        }
        resetForm();
        await loadTables();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
});

layoutButtons.forEach((button) => {
    button.addEventListener('click', () => {
        tableLayout = button.dataset.tableLayout || 'list';
        localStorage.setItem('restaurantTablesLayout', tableLayout);
        renderTables(tablesCache);
    });
});

cancelEdit?.addEventListener('click', resetForm);
if (refreshBtn) refreshBtn.addEventListener('click', loadTables);

applyLayoutButtons();
await loadTables();
