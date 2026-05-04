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

let currentImageObjectUrl = null;

const imageUrlInput = document.getElementById('item-image-url');
const imageFileInput = document.getElementById('item-image-file');
const imagePreview = document.getElementById('item-image-preview');

function setImagePreview(src) {
    if (!imagePreview) return;
    if (!src) {
        imagePreview.src = '';
        imagePreview.classList.add('hidden');
        return;
    }
    imagePreview.src = src;
    imagePreview.classList.remove('hidden');
}

if (imageUrlInput) {
    imageUrlInput.addEventListener('input', () => {
        const val = imageUrlInput.value.trim();
        if (val) {
            if (currentImageObjectUrl) {
                URL.revokeObjectURL(currentImageObjectUrl);
                currentImageObjectUrl = null;
            }
            setImagePreview(val);
        } else {
            setImagePreview('');
        }
    });
}

if (imageFileInput) {
    imageFileInput.addEventListener('change', () => {
        const file = imageFileInput.files && imageFileInput.files[0];
        if (!file) {
            if (imageUrlInput && imageUrlInput.value.trim()) {
                setImagePreview(imageUrlInput.value.trim());
            } else {
                setImagePreview('');
            }
            return;
        }

        if (currentImageObjectUrl) {
            URL.revokeObjectURL(currentImageObjectUrl);
        }
        currentImageObjectUrl = URL.createObjectURL(file);
        setImagePreview(currentImageObjectUrl);
    });
}

let editingItemId = null;
let itemsCache = [];
let menuLayout = localStorage.getItem('restaurantMenuLayout') || 'grid';
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
const compositionSection = document.getElementById('composition-section');
const decomposableInput = document.getElementById('item-decomposable');
const layoutButtons = document.querySelectorAll('[data-items-layout]');

const getKindLabel = (kind) => kind === 'boisson' ? 'Boisson' : 'Plat';
const normalizeCompositionName = (value = '') =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

function setCompositionSectionVisible(visible, options = {}) {
    if (!compositionSection) return;

    compositionSection.classList.toggle('hidden', !visible);

    if (!visible) {
        compositionSuggestions?.classList.add('hidden');
        if (options.clear !== false) {
            syncSelectedCompositionSelections([]);
            if (compositionSearchInput) compositionSearchInput.value = '';
        }
    }
}

function applyLayoutButtons() {
    layoutButtons.forEach((button) => {
        const isActive = button.dataset.itemsLayout === menuLayout;
        button.classList.toggle('bg-gray-900', isActive);
        button.classList.toggle('text-white', isActive);
        button.classList.toggle('border-gray-900', isActive);
        button.classList.toggle('bg-white', !isActive);
        button.classList.toggle('text-gray-600', !isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

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
        selectedCompositionsContainer.innerHTML = '<span class="text-sm text-gray">Aucune composition selectionnee</span>';
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
            <span class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${isExisting ? 'bg-gray-100 text-white' : 'bg-yellow-100 text-yellow-700'}">
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
                    <span class="font-medium text-gray-200">${escapeHtml(composition.name)}</span>
                    ${composition.is_allergen ? '<span class="ml-2 text-xs text-red-500">Allergene</span>' : ''}
                </span>
                <span class="text-xs text-gray-400">Existant</span>
            </button>
        `).join('')}
        ${shouldOfferCreate ? `
            <button type="button" class="composition-create flex w-full items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-left hover:bg-yellow-50" data-composition-name="${escapeHtml(query.trim())}">
                <span>
                    <span class="font-medium text-gray-200">${escapeHtml(query.trim())}</span>
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
        <option value="">Aucune categorie</option>
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
    itemsCache = items;
    applyLayoutButtons();

    if (!items.length) {
        itemsList.className = '';
        itemsList.innerHTML = '<div class="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center text-gray">Aucun article trouve</div>';
        return;
    }

    itemsList.className = menuLayout === 'grid'
        ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5'
        : 'space-y-4';
    itemsList.innerHTML = items.map((item) => (
        menuLayout === 'grid' ? renderGridItem(item) : renderListItem(item)
    )).join('');

    document.querySelectorAll('.edit-item').forEach((btn) => btn.addEventListener('click', () => editItem(btn.dataset.id)));
    document.querySelectorAll('.toggle-item').forEach((btn) => btn.addEventListener('click', () => toggleItem(btn.dataset.id)));
    document.querySelectorAll('.delete-item').forEach((btn) => btn.addEventListener('click', () => deleteItem(btn.dataset.id)));
}

function renderBadges(item) {
    const taxonomy = getCardTaxonomy(item);
    const available = item.is_available !== false;

    return `
        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
            ${available ? 'Disponible' : 'Indisponible'}
        </span>
        ${item.is_promo ? '<span class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Promotion</span>' : ''}
        ${taxonomy.map((label, index) => `
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${index === 0 ? 'bg-gray-100 text-white' : index === 1 ? 'bg-yellow-50 text-yellow-700' : 'bg-blue-50 text-blue-700'}">
                ${escapeHtml(label)}
            </span>
        `).join('')}
    `;
}

function renderCompositionsPreview(item, limit = 3) {
    const compositions = item.compositions || [];
    if (!compositions.length) {
        return '<span class="text-xs text-gray-400">Aucune composition</span>';
    }

    return `
        ${compositions.slice(0, limit).map((composition) => `
            <span class="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">${escapeHtml(composition.name)}</span>
        `).join('')}
        ${compositions.length > limit ? `<span class="text-xs text-gray-400">+${compositions.length - limit}</span>` : ''}
    `;
}

function renderActions(item, compact = false) {
    const available = item.is_available !== false;
    const buttonBase = compact
        ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors'
        : 'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors';

    return `
        <button aria-label="Modifier ${escapeHtml(item.name)}" class="edit-item ${buttonBase} text-primary hover:bg-yellow-100" data-id="${escapeHtml(item.id)}">
            <i class="fas fa-edit" aria-hidden="true"></i>${compact ? '' : '<span>Modifier</span>'}
        </button>
        <button aria-label="Basculer disponibilite ${escapeHtml(item.name)}" class="toggle-item ${buttonBase} ${available ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}" data-id="${escapeHtml(item.id)}">
            <i class="fas ${available ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>${compact ? '' : `<span>${available ? 'Desactiver' : 'Activer'}</span>`}
        </button>
        <button aria-label="Supprimer ${escapeHtml(item.name)}" class="delete-item ${buttonBase} text-red-500 hover:bg-red-50" data-id="${escapeHtml(item.id)}">
            <i class="fas fa-trash-alt" aria-hidden="true"></i>${compact ? '' : '<span>Supprimer</span>'}
        </button>
    `;
}

function renderGridItem(item) {
    return `
        <article role="listitem" class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" aria-label="Article ${escapeHtml(item.name)}">
            <div class="relative aspect-[4/3] bg-gray-100">
                ${item.image_url ? `
                    <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" class="h-full w-full object-cover">
                ` : `
                    <div class="flex h-full items-center justify-center text-gray-300" aria-hidden="true">
                        <i class="fas fa-utensils text-4xl"></i>
                    </div>
                `}
                <div class="absolute left-3 top-3 flex flex-wrap gap-2">
                    <span class="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">${escapeHtml(getKindLabel(item.kind))}</span>
                    ${item.is_promo ? '<span class="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">Promo</span>' : ''}
                </div>
            </div>
            <div class="p-4">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h3 class="truncate text-lg font-semibold text-gray-900">${escapeHtml(item.name)}</h3>
                        <p class="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-gray">${escapeHtml(item.description || 'Aucune description')}</p>
                    </div>
                    <p class="shrink-0 text-lg font-bold text-primary">${formatPrice(item.price)}</p>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">${renderBadges(item)}</div>
                <div class="mt-3 flex flex-wrap gap-1">${renderCompositionsPreview(item)}</div>
                <div class="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                    <span class="text-xs font-medium text-gray"><i class="far fa-clock mr-1"></i>${item.prep_time || 0} min</span>
                    <div class="flex gap-1">${renderActions(item, true)}</div>
                </div>
            </div>
        </article>
    `;
}

function renderListItem(item) {
    return `
        <article role="listitem" class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md" aria-label="Article ${escapeHtml(item.name)}">
            <div class="flex flex-col gap-4 md:flex-row md:items-center">
                <div class="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-gray-100 md:w-36">
                    ${item.image_url ? `
                        <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" class="h-full w-full object-cover">
                    ` : `
                        <div class="flex h-full items-center justify-center text-gray-300" aria-hidden="true">
                            <i class="fas fa-utensils text-3xl"></i>
                        </div>
                    `}
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-lg font-semibold text-gray-900">${escapeHtml(item.name)}</h3>
                        ${renderBadges(item)}
                    </div>
                    <p class="mt-1 line-clamp-2 text-sm text-gray">${escapeHtml(item.description || 'Aucune description')}</p>
                    <div class="mt-2 flex flex-wrap gap-1">${renderCompositionsPreview(item, 5)}</div>
                </div>
                <div class="flex shrink-0 flex-col gap-3 md:items-end">
                    <div>
                        <p class="text-xl font-bold text-primary">${formatPrice(item.price)}</p>
                        <p class="text-xs text-gray">${item.prep_time || 0} min</p>
                    </div>
                    <div class="flex flex-wrap gap-2">${renderActions(item)}</div>
                </div>
            </div>
        </article>
    `;
}

async function loadItems() {
    showItemsSkeleton();
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
        hideItemsSkeleton();
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        itemsList.innerHTML = '<div class="text-center py-12 text-red-500">Erreur de chargement</div>';
        hideItemsSkeleton();
    }
}

function showItemsSkeleton() {
    const el = document.getElementById('items-list');
    if (!el) return;
    el.innerHTML = `
        <div class="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div class="flex flex-col gap-4 md:flex-row md:items-center">
                <div class="h-28 w-full shrink-0 animate-pulse rounded-xl bg-gray-200 md:w-36"></div>
                <div class="min-w-0 flex-1 space-y-2 py-1">
                    <div class="h-4 w-1/3 animate-pulse rounded bg-gray-200"></div>
                    <div class="h-3 w-full animate-pulse rounded bg-gray-200"></div>
                    <div class="h-3 w-5/6 animate-pulse rounded bg-gray-200"></div>
                </div>
                <div class="flex shrink-0 flex-col gap-3 md:items-end">
                    <div class="space-y-2">
                        <div class="h-5 w-16 animate-pulse rounded bg-gray-200"></div>
                        <div class="h-3 w-10 animate-pulse rounded bg-gray-200"></div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <div class="h-9 w-20 animate-pulse rounded-lg bg-gray-200"></div>
                        <div class="h-9 w-24 animate-pulse rounded-lg bg-gray-200"></div>
                        <div class="h-9 w-20 animate-pulse rounded-lg bg-gray-200"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function hideItemsSkeleton() {
    // noop — real content will replace innerHTML when renderItems runs
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
    setImagePreview('');
}

function openModal() {
    resetForm();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    // accessibility: mark background inert and focus first input
    const main = document.querySelector('main') || document.body;
    if (main) main.setAttribute('aria-hidden', 'true');
    modal.setAttribute('aria-hidden', 'false');
    const first = modal.querySelector('input,select,button,textarea');
    if (first) first.focus();
    trapFocus(modal);
}

function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    compositionSuggestions.classList.add('hidden');
    if (currentImageObjectUrl) {
        URL.revokeObjectURL(currentImageObjectUrl);
        currentImageObjectUrl = null;
    }
    if (imageFileInput) imageFileInput.value = '';
    setImagePreview('');
    const main = document.querySelector('main') || document.body;
    if (main) main.removeAttribute('aria-hidden');
    modal.setAttribute('aria-hidden', 'true');
    releaseFocusTrap();
}

// Focus trap implementation for modal
let _focusTrap = null;
function trapFocus(container) {
    releaseFocusTrap();
    const focusable = Array.from(container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select'))
        .filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const keyHandler = (e) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };
    _focusTrap = keyHandler;
    window.addEventListener('keydown', keyHandler);
}

function releaseFocusTrap() {
    if (_focusTrap) {
        window.removeEventListener('keydown', _focusTrap);
        _focusTrap = null;
    }
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
        // preview existing image
        setImagePreview(item.image_url || '');
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

    let submitBtn = null;
    let originalLabel = null;
    try {
        submitBtn = itemForm.querySelector('button[type="submit"]');
        originalLabel = submitBtn ? submitBtn.textContent : null;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enregistrement...';
        }
        const category = await ensureCategorySelection();
        if (!category) {
            showToast('Veuillez selectionner ou creer une categorie', 'warning');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
            return;
        }

        await loadTypeCategories(category.id, typeCategorySelect.value);
        const typeCategory = await ensureTypeCategorySelection(category.id);

        // Ensure any new compositions (created via Enter) exist on server before saving the plat
        const newSelections = selectedCompositionSelections.filter(s => !s.composition_id && s.name).map(s => s.name.trim()).filter(Boolean);
        const uniqueNew = [...new Set(newSelections.map(n => normalizeCompositionName(n)))];
        const createdMap = {};
        if (uniqueNew.length) {
            for (const nameNorm of uniqueNew) {
                const existing = compositionsCache.find(c => normalizeCompositionName(c.name) === nameNorm);
                if (existing) {
                    createdMap[nameNorm] = existing;
                    continue;
                }
                try {
                    const createdResp = await compositionsService.create({ name: nameNorm });
                    const created = createdResp.data;
                    if (created) {
                        compositionsCache.push(created);
                        createdMap[nameNorm] = created;
                    }
                } catch (err) {
                    // ignore individual creation errors but notify user
                    showToast(`Erreur creation composition: ${nameNorm}`, 'warning');
                }
            }
            // refresh suggestions cache
            renderCompositionSuggestions(compositionSearchInput?.value || '');
        }

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
            compositionSelections: selectedCompositionSelections.map((selection) => {
                if (selection.composition_id) return { composition_id: selection.composition_id };
                const norm = normalizeCompositionName(selection.name || '');
                const created = createdMap[norm];
                if (created) return { composition_id: created.id };
                return { name: selection.name };
            })
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
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel || 'Enregistrer';
        }
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
