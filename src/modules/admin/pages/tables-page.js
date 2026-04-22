import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, confirmDialog, escapeHtml } from '../../../shared/utils/index.js';
import { authService } from '../services/authService.js';
import { tablesService } from '../services/tablesService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Accès administrateur requis');
}

let editingTableId = null;

const tablesList = document.getElementById('tables-list');
const refreshBtn = document.getElementById('refresh-tables');
const tableForm = document.getElementById('table-form');
const formTitle = document.getElementById('form-title');
const cancelEdit = document.getElementById('cancel-edit');

async function loadTables() {
    try {
        const response = await tablesService.getAll();
        renderTables(response.data || []);
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        tablesList.innerHTML = '<div class="text-center py-8 text-red-500">Erreur de chargement</div>';
    }
}

function renderTables(tables) {
    if (!tables.length) {
        tablesList.innerHTML = '<div class="text-center py-8 text-gray-500">Aucune table trouvée</div>';
        return;
    }

    tablesList.innerHTML = tables.map((table) => `
        <div class="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
            <div class="flex-1">
                <div class="flex items-center gap-3">
                    <i class="fas fa-table text-primary"></i>
                    <div>
                        <p class="font-semibold">${escapeHtml(table.name)}</p>
                        <p class="text-sm text-gray-500">${escapeHtml(table.number)}</p>
                    </div>
                    ${!table.is_active ? '<span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>' : ''}
                </div>
                <div class="mt-2">
                    <p class="text-xs text-gray-400 break-all">
                        <i class="fas fa-qrcode mr-1"></i>QR: ${escapeHtml(table.qr_code || 'Généré automatiquement')}
                    </p>
                    <p class="text-xs text-gray-400 mt-1 break-all">
                        <i class="fas fa-link mr-1"></i>
                        <a href="${tablesService.getClientMenuUrl(table)}" target="_blank" class="text-primary hover:underline">
                            ${escapeHtml(table.menu_url || tablesService.getClientMenuUrl(table))}
                        </a>
                    </p>
                </div>
            </div>
            <div class="flex gap-2">
                <button class="edit-table text-primary hover:bg-yellow-100 px-3 py-1.5 rounded-lg text-sm" data-id="${escapeHtml(table.id)}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-table text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm" data-id="${escapeHtml(table.id)}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.edit-table').forEach((button) => {
        button.addEventListener('click', () => editTable(button.dataset.id));
    });

    document.querySelectorAll('.delete-table').forEach((button) => {
        button.addEventListener('click', () => deleteTable(button.dataset.id));
    });
}

async function editTable(id) {
    try {
        const response = await tablesService.getById(id);
        const table = response.data;

        editingTableId = table.id;
        formTitle.textContent = `Modifier: ${table.name}`;
        document.getElementById('table-name').value = table.name || '';
        document.getElementById('table-number').value = table.number || '';
        document.getElementById('table-qr-code').value = table.qr_code || '';
        document.getElementById('table-active').checked = table.is_active !== false;
        cancelEdit.classList.remove('hidden');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
    }
}

async function deleteTable(id) {
    const confirmed = await confirmDialog('Supprimer cette table ? Les sessions associées seront également supprimées.', 'Confirmation');
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
    formTitle.textContent = 'Nouvelle table';
    tableForm.reset();
    document.getElementById('table-active').checked = true;
    cancelEdit.classList.add('hidden');
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
            showToast('Table modifiée', 'success');
        } else {
            await tablesService.create(payload);
            showToast('Table créée', 'success');
        }

        resetForm();
        await loadTables();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
});

cancelEdit?.addEventListener('click', resetForm);
refreshBtn?.addEventListener('click', loadTables);

await loadTables();
