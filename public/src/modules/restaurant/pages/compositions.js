import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, confirmDialog, escapeHtml, debounce } from '../../../shared/utils/index.js';
import { authService } from '../services/authService.js';
import { compositionsService } from '../services/compositionsService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Accès administrateur requis');
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
    const activeCheckbox = document.getElementById('comp-active');
    if (activeCheckbox) activeCheckbox.checked = true;
    if (submitLabel) submitLabel.textContent = 'Ajouter';
    cancelEditBtn?.classList.add('hidden');
}

async function loadCompositions() {
    showCompositionsSkeleton();
    try {
        const search = searchInput ? searchInput.value.trim() : '';
        const response = await compositionsService.getAll(search ? { search } : {});
        compositionsCache = response.data || [];
        renderCompositions(compositionsCache);
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        if (compositionsList) {
            compositionsList.innerHTML = '<div class="text-center py-12 text-sm font-semibold text-red-500">Erreur de chargement du registre</div>';
        }
    }
}

function showCompositionsSkeleton() {
    if (!compositionsList) return;
    compositionsList.innerHTML = `
        <div class="space-y-3">
            ${[1, 2, 3, 4].map(() => `
                <div class="p-4 border border-gray-100 rounded-xl space-y-2 bg-white opacity-70">
                    <div class="flex justify-between">
                        <div class="skeleton h-5 w-32"></div>
                        <div class="skeleton h-5 w-14 rounded-full"></div>
                    </div>
                    <div class="skeleton h-4 w-3/4"></div>
                    <div class="flex gap-2 pt-1">
                        <div class="skeleton h-4 w-16"></div>
                        <div class="skeleton h-4 w-20"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderCompositions(compositions) {
    if (!compositionsList) return;
    if (!compositions.length) {
        compositionsList.innerHTML = `
            <div class="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center text-sm font-semibold text-gray-400">
                <i class="fas fa-tags text-2xl block mb-2 text-gray-300"></i> Aucune composition trouvée
            </div>`;
        return;
    }

    compositionsList.innerHTML = compositions.map((composition) => `
        <div class="group flex items-center justify-between gap-4 p-4 border border-gray-100 rounded-xl bg-white transition-all duration-150 hover:bg-gray-50/70 hover:border-gray-200 ${composition.is_active === false ? 'bg-gray-50/40 opacity-65' : ''}">
            
            <!-- Section Informations -->
            <div class="flex-1 min-w-0 space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-gray-900 tracking-tight">${escapeHtml(composition.name)}</span>
                    
                    <!-- Badge Allergène -->
                    ${composition.is_allergen ? `
                        <span class="inline-flex items-center gap-1 text-[11px] font-medium bg-red-50 text-red-700 px-2 py-0.5 rounded-md ring-1 ring-inset ring-red-600/10">
                            <span class="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            Allergène
                        </span>
                    ` : ''}
                    
                    <!-- Badge Inactif -->
                    ${composition.is_active === false ? `
                        <span class="inline-flex items-center text-[11px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md border border-gray-200">
                            Inactif
                        </span>
                    ` : ''}
                </div>

                <!-- Description -->
                ${composition.description ? `
                    <p class="text-sm text-gray-500 leading-relaxed max-w-2xl">${escapeHtml(composition.description)}</p>
                ` : ''}

                <!-- Métadonnées (Alias & ID) -->
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-gray-400 font-medium">
                    ${(composition.aliases || []).length ? `
                        <span class="inline-flex items-center gap-1 bg-gray-100/70 px-1.5 py-0.5 rounded text-gray-500 font-sans">
                            <i class="fas fa-tags text-[9px] text-gray-400"></i>
                            ${escapeHtml(composition.aliases.join(', '))}
                        </span>
                    ` : ''}
                    <span class="font-mono text-[10px]">ID: ${escapeHtml(composition.id)}</span>
                </div>
            </div>

            <!-- Section Actions (Boutons carrés épurés) -->
            <div class="flex gap-1 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                <button class="edit-comp inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-amber-600 transition-colors" data-id="${escapeHtml(composition.id)}" aria-label="Modifier">
                    <i class="fas fa-edit text-sm"></i>
                </button>
                <button class="delete-comp inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" data-id="${escapeHtml(composition.id)}" aria-label="Supprimer">
                    <i class="fas fa-trash-alt text-sm"></i>
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
        showToast('Composition supprimée', 'success');
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
    
    let submitBtn = compositionForm.querySelector('button[type="submit"]');
    let originalLabel = submitBtn ? submitBtn.textContent : null;

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enregistrement...';
        }

        if (editingCompositionId) {
            await compositionsService.update(editingCompositionId, payload);
            showToast('Composition modifiée', 'success');
        } else {
            await compositionsService.create(payload);
            showToast('Composition ajoutée', 'success');
        }
        resetCompositionForm();
        await loadCompositions();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel || 'Ajouter';
        }
    }
});

cancelEditBtn?.addEventListener('click', resetCompositionForm);
if (searchInput) searchInput.addEventListener('input', debounce(loadCompositions, 300));
if (refreshBtn) refreshBtn.addEventListener('click', loadCompositions);

// Amorçage initial
resetCompositionForm();
await loadCompositions();