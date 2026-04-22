import { formatPrice } from '../../../shared/api/apiClient.js';
import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, confirmDialog, escapeHtml, debounce } from '../../../shared/utils/index.js';
import { authService } from '../services/authService.js';
import { categoriesService } from '../services/categoriesService.js';
import { compositionsService } from '../services/compositionsService.js';
import { platsService } from '../services/platsService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Accès administrateur requis');
}

let editingItemId = null;
let compositionsCache = [];
let categoriesCache = [];
let typeCategoriesCache = [];
let selectedCompositionSelections = [];

const itemsList = document.getElementById('items-list');
const searchInput = document.getElementById('search-items');
const kindFilter = document.getElementById('kind-filter');
const sortSelect = document.getElementById('sort-items');
const refreshBtn = document.getElementById('refresh-items');
const newItemBtn = document.getElementById('new-item-btn');
const modal = document.getElementById('item-modal');
const itemForm = document.getElementById('item-form');
const modalTitle = document.getElementById('modal-title');
const closeModalBtn = document.getElementById('close-modal');
const cancelModalBtn = document.getElementById('cancel-modal');

const kindSelect = document.getElementById('item-kind');
const categorySelect = document.getElementById('item-category-id');
const typeCategorySelect = document.getElementById('item-type-category-id');
const newCategoryInput = document.getElementById('item-new-category');
const newTypeCategoryInput = document.getElementById('item-new-type-category');
const compositionSearchInput = document.getElementById('composition-search');
const compositionSuggestions = document.getElementById('composition-suggestions');
const selectedCompositionsContainer = document.getElementById('selected-compositions');

const getKindLabel = (kind) => kind === 'boisson' ? 'Boisson' : 'Plat';
const normalizeCompositionName = (value = '') =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

function setDayInputsEnabled(enabled) {
    document.querySelectorAll('.availability-day').forEach((day) => {
        day.disabled = !enabled;
        day.closest('label').style.opacity = enabled ? '1' : '0.5';
    });
}

function getSelectedCompositionSignature(selection) {
    return selection.composition_id || `custom:${normalizeCompositionName(selection.name)}`;
}

function syncSelectedCompositionSelections(selections = []) {
    const uniqueSelections = [];
    const seen = new Set();

    selections.forEach((selection) => {
        if (!selection) return;
        const normalizedSelection = selection.composition_id
            ? {
                composition_id: selection.composition_id,
                name: selection.name || compositionsCache.find((item) => item.id === selection.composition_id)?.name || ''
            }
            : {
                name: String(selection.name || '').trim()
            };

        if (!normalizedSelection.composition_id && !normalizedSelection.name) return;
        const signature = getSelectedCompositionSignature(normalizedSelection);
        if (seen.has(signature)) return;
        seen.add(signature);
        uniqueSelections.push(normalizedSelection);
    });

    selectedCompositionSelections = uniqueSelections;
    renderSelectedCompositions();
    renderCompositionSuggestions(compositionSearchInput?.value || '');
}

function renderSelectedCompositions() {
    if (!selectedCompositionsContainer) return;

    if (!selectedCompositionSelections.length) {
        selectedCompositionsContainer.innerHTML = '<span class="text-sm text-gray-500">Aucune composition selectionnee</span>';
        return;
    }

    selectedCompositionsContainer.innerHTML = selectedCompositionSelections.map((selection) => {
        const existing = selection.composition_id
            ? compositionsCache.find((item) => item.id === selection.composition_id)
            : null;
        const label = selection.name || existing?.name || selection.composition_id;
        const isExisting = Boolean(selection.composition_id);
        const isAllergen = Boolean(existing?.is_allergen);

        return `
            <span class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${isExisting ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'}">
                <span>${escapeHtml(label)}</span>
                ${isAllergen ? '<span class="text-red-500">Allergene</span>' : ''}
                ${!isExisting ? '<span class="opacity-70">Nouveau</span>' : ''}
                <button type="button" class="remove-composition-chip text-current/70 hover:text-current" data-signature="${escapeHtml(getSelectedCompositionSignature(selection))}">
                    <i class="fas fa-times"></i>
                </button>
            </span>
        `;
    }).join('');

    document.querySelectorAll('.remove-composition-chip').forEach((button) => {
        button.addEventListener('click', () => {
            const signature = button.dataset.signature;
            syncSelectedCompositionSelections(
                selectedCompositionSelections.filter((selection) => getSelectedCompositionSignature(selection) !== signature)
            );
        });
    });
}

function renderCompositionSuggestions(query = '') {
    if (!compositionSuggestions) return;

    const normalizedQuery = normalizeCompositionName(query);
    const selectedSignatures = new Set(selectedCompositionSelections.map(getSelectedCompositionSignature));
    const filteredExisting = compositionsCache
        .filter((composition) => !selectedSignatures.has(composition.id))
        .filter((composition) => {
            if (!normalizedQuery) return true;
            return normalizeCompositionName(composition.name).includes(normalizedQuery);
        })
        .slice(0, 8);

    const shouldOfferCreate = normalizedQuery
        && !compositionsCache.some((composition) => normalizeCompositionName(composition.name) === normalizedQuery)
        && !selectedSignatures.has(`custom:${normalizedQuery}`);

    if (!filteredExisting.length && !shouldOfferCreate) {
        compositionSuggestions.classList.add('hidden');
        compositionSuggestions.innerHTML = '';
        return;
    }

    compositionSuggestions.innerHTML = `
        ${filteredExisting.map((composition) => `
            <button type="button" class="composition-suggestion flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50" data-composition-id="${escapeHtml(composition.id)}">
                <span>
                    <span class="font-medium text-gray-800">${escapeHtml(composition.name)}</span>
                    ${composition.is_allergen ? '<span class="ml-2 text-xs text-red-500">Allergene</span>' : ''}
                </span>
                <span class="text-xs text-gray-400">Existant</span>
            </button>
        `).join('')}
        ${shouldOfferCreate ? `
            <button type="button" class="composition-create flex w-full items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-left hover:bg-yellow-50" data-composition-name="${escapeHtml(query.trim())}">
                <span>
                    <span class="font-medium text-gray-800">${escapeHtml(query.trim())}</span>
                </span>
                <span class="text-xs font-semibold text-yellow-700">Creer</span>
            </button>
        ` : ''}
    `;

    compositionSuggestions.classList.remove('hidden');

    compositionSuggestions.querySelectorAll('.composition-suggestion').forEach((button) => {
        button.addEventListener('click', () => {
            const composition = compositionsCache.find((item) => item.id === button.dataset.compositionId);
            if (!composition) return;
            syncSelectedCompositionSelections([
                ...selectedCompositionSelections,
                { composition_id: composition.id, name: composition.name }
            ]);
            compositionSearchInput.value = '';
            renderCompositionSuggestions('');
        });
    });

    compositionSuggestions.querySelectorAll('.composition-create').forEach((button) => {
        button.addEventListener('click', () => {
            const name = button.dataset.compositionName?.trim();
            if (!name) return;
            syncSelectedCompositionSelections([
                ...selectedCompositionSelections,
                { name }
            ]);
            compositionSearchInput.value = '';
            renderCompositionSuggestions('');
        });
    });
}

async function loadCompositions() {
    const response = await compositionsService.getAll();
    compositionsCache = response.data || [];
    renderCompositionSuggestions(compositionSearchInput?.value || '');
    renderSelectedCompositions();
}

function renderCategoryOptions(selectedId = '') {
    categorySelect.innerHTML = `
        <option value="">Selectionner une categorie</option>
        ${categoriesCache.map((category) => `
            <option value="${escapeHtml(category.id)}" ${category.id === selectedId ? 'selected' : ''}>
                ${escapeHtml(category.name)}
            </option>
        `).join('')}
    `;
}

function renderTypeCategoryOptions(selectedId = '') {
    typeCategorySelect.innerHTML = `
        <option value="">Aucun type</option>
        ${typeCategoriesCache.map((typeCategory) => `
            <option value="${escapeHtml(typeCategory.id)}" ${typeCategory.id === selectedId ? 'selected' : ''}>
                ${escapeHtml(typeCategory.name)}
            </option>
        `).join('')}
    `;
}

async function loadCategories(kind, selectedId = '') {
    const response = await categoriesService.getAll({ kind });
    categoriesCache = response.data || [];
    renderCategoryOptions(selectedId);
}

async function loadTypeCategories(categoryId, selectedId = '') {
    if (!categoryId) {
        typeCategoriesCache = [];
        renderTypeCategoryOptions(selectedId);
        return;
    }

    const response = await categoriesService.getTypes(categoryId);
    typeCategoriesCache = response.data || [];
    renderTypeCategoryOptions(selectedId);
}

async function ensureCategorySelection() {
    const selectedCategoryId = categorySelect.value;
    const newCategoryName = newCategoryInput.value.trim();
    const kind = kindSelect.value;

    if (selectedCategoryId) {
        const category = categoriesCache.find((entry) => entry.id === selectedCategoryId);
        return category ? { id: category.id, name: category.name } : null;
    }

    if (!newCategoryName) {
        return null;
    }

    const response = await categoriesService.create({ name: newCategoryName, kind });
    const category = response.data;
    categoriesCache.push(category);
    renderCategoryOptions(category.id);
    return { id: category.id, name: category.name };
}

async function ensureTypeCategorySelection(categoryId) {
    const selectedTypeId = typeCategorySelect.value;
    const newTypeName = newTypeCategoryInput.value.trim();

    if (selectedTypeId) {
        const typeCategory = typeCategoriesCache.find((entry) => entry.id === selectedTypeId);
        return typeCategory ? { id: typeCategory.id, name: typeCategory.name } : null;
    }

    if (!newTypeName || !categoryId) {
        return null;
    }

    const response = await categoriesService.createType({ categorie_id: categoryId, name: newTypeName });
    const typeCategory = response.data;
    typeCategoriesCache.push(typeCategory);
    renderTypeCategoryOptions(typeCategory.id);
    return { id: typeCategory.id, name: typeCategory.name };
}

function getCardTaxonomy(item) {
    const parts = [getKindLabel(item.kind)];
    if (item.categorie_name) parts.push(item.categorie_name);
    if (item.type_categorie_name) parts.push(item.type_categorie_name);
    return parts;
}

function renderItems(items) {
    if (!items.length) {
        itemsList.innerHTML = '<div class="text-center py-12 text-gray-500">Aucun article trouve</div>';
        return;
    }

    itemsList.innerHTML = items.map((item) => `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div class="flex flex-col md:flex-row">
                ${item.image_url ? `
                    <div class="md:w-48 h-32 md:h-auto">
                        <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" class="w-full h-full object-cover">
                    </div>
                ` : `
                    <div class="md:w-48 h-32 md:h-auto bg-gray-100 flex items-center justify-center">
                        <i class="fas fa-utensils text-3xl text-gray-400"></i>
                    </div>
                `}
                <div class="flex-1 p-4">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h3 class="font-semibold text-lg">${escapeHtml(item.name)}</h3>
                                ${getCardTaxonomy(item).map((label, index) => `
                                    <span class="px-2 py-0.5 rounded-full text-xs font-medium ${index === 0 ? 'bg-gray-100' : index === 1 ? 'bg-yellow-50 text-yellow-700' : 'bg-blue-50 text-blue-700'}">${escapeHtml(label)}</span>
                                `).join('')}
                                ${item.is_promo ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Promo</span>' : ''}
                                ${!item.is_available ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Indisponible</span>' : ''}
                            </div>
                            <p class="text-sm text-gray-500 mt-1 line-clamp-2">${escapeHtml(item.description || 'Aucune description')}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xl font-bold text-primary">${formatPrice(item.price)}</p>
                            <p class="text-xs text-gray-500">${item.prep_time || 0} min</p>
                        </div>
                    </div>

                    <div class="mt-3 flex items-center justify-between flex-wrap gap-2">
                        <div class="flex flex-wrap gap-1">
                            ${(item.compositions || []).slice(0, 3).map((composition) => `
                                <span class="text-xs bg-gray-100 px-2 py-1 rounded-full">${escapeHtml(composition.name)}</span>
                            `).join('')}
                            ${(item.compositions || []).length > 3 ? `<span class="text-xs text-gray-400">+${item.compositions.length - 3}</span>` : ''}
                        </div>
                        <div class="flex gap-2">
                            <button class="edit-item text-primary hover:bg-yellow-100 px-3 py-1.5 rounded-lg text-sm transition-colors" data-id="${escapeHtml(item.id)}">
                                <i class="fas fa-edit mr-1"></i>Modifier
                            </button>
                            <button class="toggle-item ${item.is_available ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'} px-3 py-1.5 rounded-lg text-sm transition-colors" data-id="${escapeHtml(item.id)}">
                                <i class="fas ${item.is_available ? 'fa-eye-slash' : 'fa-eye'} mr-1"></i>
                                ${item.is_available ? 'Desactiver' : 'Activer'}
                            </button>
                            <button class="delete-item text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm transition-colors" data-id="${escapeHtml(item.id)}">
                                <i class="fas fa-trash-alt mr-1"></i>Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.edit-item').forEach((btn) => btn.addEventListener('click', () => editItem(btn.dataset.id)));
    document.querySelectorAll('.toggle-item').forEach((btn) => btn.addEventListener('click', () => toggleItem(btn.dataset.id)));
    document.querySelectorAll('.delete-item').forEach((btn) => btn.addEventListener('click', () => deleteItem(btn.dataset.id)));
}

async function loadItems() {
    try {
        const [sortBy, sortOrder] = sortSelect.value.split(':');
        const params = {
            search: searchInput.value.trim(),
            kind: kindFilter.value === 'all' ? '' : kindFilter.value,
            sort_by: sortBy,
            sort_order: sortOrder
        };

        const response = await platsService.getAll(params);
        renderItems(response.data || []);
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        itemsList.innerHTML = '<div class="text-center py-12 text-red-500">Erreur de chargement</div>';
    }
}

function resetForm() {
    editingItemId = null;
    modalTitle.textContent = 'Nouvel article';
    itemForm.reset();
    kindSelect.value = 'plat';
    document.getElementById('item-available').checked = true;
    document.getElementById('allow-custom-message').checked = true;
    document.querySelector('input[name="availability-mode"][value="everyday"]').checked = true;
    document.querySelectorAll('.availability-day').forEach((day) => {
        day.checked = false;
    });
    setDayInputsEnabled(false);
    syncSelectedCompositionSelections([]);
    compositionSearchInput.value = '';
    newCategoryInput.value = '';
    newTypeCategoryInput.value = '';
    loadCategories('plat');
    renderTypeCategoryOptions();
}

function openModal() {
    resetForm();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    compositionSuggestions.classList.add('hidden');
}

async function editItem(id) {
    try {
        const response = await platsService.getById(id);
        const item = response.data;
        editingItemId = item.id;

        modalTitle.textContent = `Modifier: ${item.name}`;
        document.getElementById('item-name').value = item.name || '';
        kindSelect.value = item.kind || 'plat';
        await loadCategories(kindSelect.value, item.categorie_id || '');
        await loadTypeCategories(item.categorie_id || '', item.type_categorie_id || '');
        newCategoryInput.value = '';
        newTypeCategoryInput.value = '';
        document.getElementById('item-description').value = item.description || '';
        document.getElementById('item-price').value = item.price || '';
        document.getElementById('item-prep-time').value = item.prep_time || 15;
        document.getElementById('item-image-url').value = item.image_url || '';
        document.getElementById('item-promo').checked = item.is_promo || false;
        document.getElementById('item-available').checked = item.is_available !== false;
        document.getElementById('item-decomposable').checked = item.is_decomposable || false;
        document.getElementById('allow-custom-message').checked = item.allow_custom_message !== false;
        document.getElementById('custom-message-hint').value = item.custom_message_hint || '';

        const selectedDays = new Set(item.available_days || []);
        const mode = item.availability_mode === 'selected_days' ? 'selected_days' : 'everyday';
        document.querySelector(`input[name="availability-mode"][value="${mode}"]`).checked = true;
        document.querySelectorAll('.availability-day').forEach((day) => {
            day.checked = selectedDays.has(day.value);
        });
        setDayInputsEnabled(mode === 'selected_days');

        syncSelectedCompositionSelections(
            (item.compositions || []).map((composition) => ({
                composition_id: composition.id,
                name: composition.name
            }))
        );
        compositionSearchInput.value = '';
        renderCompositionSuggestions('');

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (error) {
        showToast(error.message || 'Erreur lors du chargement', 'error');
    }
}

async function toggleItem(id) {
    try {
        await platsService.toggleAvailability(id);
        showToast('Disponibilite modifiee', 'success');
        loadItems();
    } catch (error) {
        showToast(error.message || 'Erreur de mise a jour', 'error');
    }
}

async function deleteItem(id) {
    const confirmed = await confirmDialog('Supprimer definitivement cet article ?', 'Confirmation');
    if (!confirmed) return;

    try {
        await platsService.remove(id);
        showToast('Article supprime', 'success');
        if (editingItemId === id) {
            resetForm();
        }
        loadItems();
    } catch (error) {
        showToast(error.message || 'Erreur de suppression', 'error');
    }
}

itemForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
        const category = await ensureCategorySelection();
        if (!category) {
            showToast('Veuillez selectionner ou creer une categorie', 'warning');
            return;
        }

        await loadTypeCategories(category.id, typeCategorySelect.value);
        const typeCategory = await ensureTypeCategorySelection(category.id);

        const payload = {
            name: document.getElementById('item-name').value.trim(),
            kind: kindSelect.value,
            category: kindSelect.value,
            categorie_id: category.id,
            categorie_name: category.name,
            type_categorie_id: typeCategory?.id || null,
            type_categorie_name: typeCategory?.name || null,
            description: document.getElementById('item-description').value.trim(),
            price: parseFloat(document.getElementById('item-price').value),
            prep_time: parseInt(document.getElementById('item-prep-time').value, 10) || 15,
            image_url: document.getElementById('item-image-url').value.trim(),
            is_promo: document.getElementById('item-promo').checked,
            is_available: document.getElementById('item-available').checked,
            is_decomposable: document.getElementById('item-decomposable').checked,
            allow_custom_message: document.getElementById('allow-custom-message').checked,
            custom_message_hint: document.getElementById('custom-message-hint').value.trim(),
            availability_mode: document.querySelector('input[name="availability-mode"]:checked').value,
            available_days: Array.from(document.querySelectorAll('.availability-day:checked')).map((day) => day.value),
            compositionSelections: selectedCompositionSelections.map((selection) => selection.composition_id
                ? { composition_id: selection.composition_id }
                : { name: selection.name }
            )
        };

        const formData = new FormData();
        formData.append('payload', JSON.stringify(payload));

        const imageFile = document.getElementById('item-image-file').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        if (editingItemId) {
            await platsService.update(editingItemId, formData);
            showToast('Article modifie avec succes', 'success');
        } else {
            await platsService.create(formData);
            showToast('Article cree avec succes', 'success');
        }

        closeModal();
        resetForm();
        await loadItems();
        await loadCompositions();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
});

newItemBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModal();
    }
});

kindSelect.addEventListener('change', async () => {
    newCategoryInput.value = '';
    newTypeCategoryInput.value = '';
    await loadCategories(kindSelect.value);
    renderTypeCategoryOptions();
});

categorySelect.addEventListener('change', async () => {
    newTypeCategoryInput.value = '';
    await loadTypeCategories(categorySelect.value);
});

compositionSearchInput.addEventListener('input', () => {
    renderCompositionSuggestions(compositionSearchInput.value);
});

compositionSearchInput.addEventListener('focus', () => {
    renderCompositionSuggestions(compositionSearchInput.value);
});

compositionSearchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();

    const name = compositionSearchInput.value.trim();
    if (!name) return;

    const existing = compositionsCache.find((composition) => normalizeCompositionName(composition.name) === normalizeCompositionName(name));
    syncSelectedCompositionSelections([
        ...selectedCompositionSelections,
        existing
            ? { composition_id: existing.id, name: existing.name }
            : { name }
    ]);
    compositionSearchInput.value = '';
    renderCompositionSuggestions('');
});

document.addEventListener('click', (event) => {
    if (!compositionSuggestions.contains(event.target) && event.target !== compositionSearchInput) {
        compositionSuggestions.classList.add('hidden');
    }
});

document.querySelectorAll('input[name="availability-mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        setDayInputsEnabled(radio.value === 'selected_days');
    });
});

const debouncedLoad = debounce(loadItems, 300);
searchInput.addEventListener('input', debouncedLoad);
kindFilter.addEventListener('change', loadItems);
sortSelect.addEventListener('change', loadItems);
refreshBtn.addEventListener('click', loadItems);

await loadCompositions();
await loadCategories('plat');
renderTypeCategoryOptions();
syncSelectedCompositionSelections([]);
setDayInputsEnabled(false);
await loadItems();
