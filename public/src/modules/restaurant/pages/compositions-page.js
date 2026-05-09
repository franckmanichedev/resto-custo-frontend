import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, confirmDialog, escapeHtml, debounce } from '../../../shared/utils/index.js';
import { authService } from '../services/authService.js';
import { compositionsService } from '../services/compositionsService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Acces administrateur requis');
}

const compositionsList = document.getElementById('compositions-list');
const searchInput = document.getElementById('search-comps');
const refreshBtn = document.getElementById('refresh-comps');
const compositionForm = document.getElementById('composition-form');
const cancelEditBtn = document.getElementById('cancel-composition-edit');
const submitLabel = document.getElementById('composition-submit-label');

let editingCompositionId = null;
let compositionsCache = [];

function getCompositionPayload() {
    return {
        name: document.getElementById('comp-name').value.trim(),
        description: document.getElementById('comp-description').value.trim(),
        is_allergen: document.getElementById('comp-allergen').checked,
        is_active: document.getElementById('comp-active')?.checked !== false,
        aliases: String(document.getElementById('comp-aliases')?.value || '')
            .split(',')
            .map((alias) => alias.trim())
            .filter(Boolean)
    };
}

function resetCompositionForm() {
    editingCompositionId = null;
    compositionForm?.reset();
    document.getElementById('comp-active').checked = true;
    if (submitLabel) submitLabel.textContent = 'Ajouter';
    cancelEditBtn?.classList.add('hidden');
}

async function loadCompositions() {
    showCompositionsSkeleton();
    try {
        const search = searchInput.value.trim();
        const response = await compositionsService.getAll(search ? { search } : {});
        compositionsCache = response.data || [];
        renderCompositions(compositionsCache);
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        compositionsList.innerHTML = '<div class="text-center py-8 text-red-500">Erreur de chargement</div>';
    }
}

function showCompositionsSkeleton() {
    if (!compositionsList) return;
    compositionsList.innerHTML = `
        <div class="space-y-3">
            ${[1,2,3,4].map(() => `
                <div class="flex items-center justify-between gap-4 p-3 border border-gray-100 rounded-lg">
                    <div class="flex-1">
                        <div class="skeleton h-5 w-48 mb-2"></div>
                        <div class="skeleton h-4 w-3/4"></div>
                    </div>
                    <div class="flex gap-2">
                        <div class="skeleton h-8 w-8 rounded-lg"></div>
                        <div class="skeleton h-8 w-8 rounded-lg"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderCompositions(compositions) {
    if (!compositions.length) {
        compositionsList.innerHTML = '<div class="text-center py-8 text-gray">Aucune composition trouvee</div>';
        return;
    }

    compositionsList.innerHTML = compositions.map((composition) => `
        <div class="flex items-center justify-between gap-4 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
            <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium">${escapeHtml(composition.name)}</span>
                    ${composition.is_allergen ? '<span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Allergene</span>' : ''}
                    ${composition.is_active === false ? '<span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inactive</span>' : ''}
                </div>
                ${composition.description ? `<p class="text-sm text-gray mt-1">${escapeHtml(composition.description)}</p>` : ''}
                ${(composition.aliases || []).length ? `<p class="text-xs text-gray-400 mt-1">Alias: ${escapeHtml(composition.aliases.join(', '))}</p>` : ''}
                <p class="text-xs text-gray-400 mt-1">ID: ${escapeHtml(composition.id)}</p>
            </div>
            <div class="flex gap-2">
                <button class="edit-comp text-primary hover:bg-yellow-100 px-3 py-1.5 rounded-lg text-sm transition-colors" data-id="${escapeHtml(composition.id)}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-comp text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm transition-colors" data-id="${escapeHtml(composition.id)}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.edit-comp').forEach((button) => {
        button.addEventListener('click', () => editComposition(button.dataset.id));
    });

    document.querySelectorAll('.delete-comp').forEach((button) => {
        button.addEventListener('click', () => deleteComposition(button.dataset.id));
    });
}

async function editComposition(id) {
    try {
        const fallback = compositionsCache.find((composition) => composition.id === id);
        const response = await compositionsService.getById(id);
        const composition = response.data || fallback;

        if (!composition) {
            showToast('Composition introuvable', 'error');
            return;
        }

        editingCompositionId = composition.id;
        document.getElementById('comp-name').value = composition.name || '';
        document.getElementById('comp-description').value = composition.description || '';
        document.getElementById('comp-allergen').checked = composition.is_allergen === true;
        document.getElementById('comp-active').checked = composition.is_active !== false;
        document.getElementById('comp-aliases').value = (composition.aliases || []).join(', ');
        if (submitLabel) submitLabel.textContent = 'Modifier';
        cancelEditBtn?.classList.remove('hidden');
        compositionForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
    }
}

async function deleteComposition(id) {
    const confirmed = await confirmDialog('Supprimer cette composition ?', 'Confirmation');
    if (!confirmed) return;

    try {
        await compositionsService.remove(id);
        showToast('Composition supprimee', 'success');
        if (editingCompositionId === id) {
            resetCompositionForm();
        }
        await loadCompositions();
    } catch (error) {
        showToast(error.message || 'Erreur de suppression', 'error');
    }
}

compositionForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = getCompositionPayload();
    if (!payload.name) {
        showToast('Le nom est requis', 'warning');
        return;
    }

    try {
        if (editingCompositionId) {
            await compositionsService.update(editingCompositionId, payload);
            showToast('Composition modifiee', 'success');
        } else {
            await compositionsService.create(payload);
            showToast('Composition ajoutee', 'success');
        }

        resetCompositionForm();
        await loadCompositions();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
});

cancelEditBtn?.addEventListener('click', resetCompositionForm);
searchInput?.addEventListener('input', debounce(loadCompositions, 300));
refreshBtn?.addEventListener('click', loadCompositions);

resetCompositionForm();
await loadCompositions();
