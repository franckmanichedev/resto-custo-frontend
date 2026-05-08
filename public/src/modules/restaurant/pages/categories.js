import { initializeAdminPage } from '../../../shared/components/adminPage.js';
import { showToast, confirmDialog, escapeHtml, debounce } from '../../../shared/utils/index.js';
import { authService } from '../services/authService.js';
import { categoriesService } from '../services/categoriesService.js';

if (!initializeAdminPage({ authService })) {
    throw new Error('Accès administrateur requis');
}

let categoriesCache = [];
let allTypesCache = [];
let typesCache = [];
let selectedCategoryId = null;
let editingCategoryId = null;
let editingTypeId = null;

const categorySearchInput = document.getElementById('category-search');
const categoryKindFilter = document.getElementById('category-kind-filter');
const refreshCategoriesBtn = document.getElementById('refresh-categories');
const categoriesList = document.getElementById('categories-list');
const selectedCategoryEmpty = document.getElementById('selected-category-empty');
const selectedCategoryPanel = document.getElementById('selected-category-panel');
const selectedCategoryName = document.getElementById('selected-category-name');
const selectedCategoryKind = document.getElementById('selected-category-kind');
const selectedCategoryDescription = document.getElementById('selected-category-description');
const typesList = document.getElementById('types-list');
const newCategoryBtn = document.getElementById('new-category-btn');
const editCategoryBtn = document.getElementById('edit-category-btn');
const deleteCategoryBtn = document.getElementById('delete-category-btn');
const newTypeBtn = document.getElementById('new-type-btn');
const addTypeToCategoryBtn = document.getElementById('add-type-to-category-btn');
const categoryModal = document.getElementById('category-modal');
const categoryModalTitle = document.getElementById('category-modal-title');
const categoryForm = document.getElementById('category-form');
const closeCategoryModalBtn = document.getElementById('close-category-modal');
const cancelCategoryModalBtn = document.getElementById('cancel-category-modal');
const typeModal = document.getElementById('type-modal');
const typeModalTitle = document.getElementById('type-modal-title');
const typeForm = document.getElementById('type-form');
const closeTypeModalBtn = document.getElementById('close-type-modal');
const cancelTypeModalBtn = document.getElementById('cancel-type-modal');
const typeParentSelect = document.getElementById('type-category-parent');

const getKindLabel = (kind) => kind === 'boisson' ? 'Boisson' : 'Plat';

function resetCategoryForm() {
    editingCategoryId = null;
    if (categoryModalTitle) categoryModalTitle.textContent = 'Nouvelle catégorie';
    categoryForm?.reset();
    const kindSelect = document.getElementById('category-kind');
    if (kindSelect) kindSelect.value = 'plat';
    const activeCheck = document.getElementById('category-active');
    if (activeCheck) activeCheck.checked = true;
}

function resetTypeForm() {
    editingTypeId = null;
    if (typeModalTitle) typeModalTitle.textContent = 'Nouveau sous-type';
    typeForm?.reset();
    const activeCheck = document.getElementById('type-active');
    if (activeCheck) activeCheck.checked = true;
    renderTypeParentOptions(selectedCategoryId);
}

function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
}

function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    modalEl.classList.remove('flex');
}

function renderTypeParentOptions(selectedId = '') {
    if (!typeParentSelect) return;
    typeParentSelect.innerHTML = categoriesCache.map((category) => `
        <option value="${escapeHtml(category.id)}" ${category.id === selectedId ? 'selected' : ''}>
            ${escapeHtml(category.name)} (${getKindLabel(category.kind)})
        </option>
    `).join('');
}

function renderCategories() {
    const selectedId = selectedCategoryId;
    if (!categoriesList) return;

    if (!categoriesCache.length) {
        categoriesList.innerHTML = `
            <div class="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center text-sm font-semibold text-gray-400">
                <i class="fas fa-folder-open text-2xl block mb-2 text-gray-300"></i> Aucune catégorie disponible
            </div>`;
        renderSelectedCategory();
        return;
    }

    categoriesList.innerHTML = categoriesCache.map((category) => {
        const typeCount = allTypesCache.filter((type) => type.categorie_id === category.id).length;
        const isSelected = category.id === selectedId;
        return `
            <button data-category-id="${escapeHtml(category.id)}" class="category-card w-full text-left rounded-xl border p-4 shadow-sm transition-all duration-200 ${isSelected ? 'border-orange-500 bg-orange-50/50 shadow-md ring-1 ring-orange-500/20' : 'border-gray-100 bg-white hover:border-orange-200 hover:shadow-md'}">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="text-base font-bold text-gray-900 tracking-tight">${escapeHtml(category.name)}</h3>
                            <span class="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 border border-gray-200/50 uppercase tracking-wide">${escapeHtml(getKindLabel(category.kind))}</span>
                            ${category.is_active === false ? '<span class="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 border border-red-100 uppercase tracking-wide">Inactif</span>' : ''}
                        </div>
                        <p class="mt-1 text-xs font-medium text-gray-500 line-clamp-2 leading-relaxed">${escapeHtml(category.description || 'Aucune description spécifiée.')}</p>
                    </div>
                    <div class="text-right text-xs font-bold shrink-0">
                        <p class="text-gray-900 font-extrabold text-lg leading-none">${typeCount}</p>
                        <p class="text-gray-400 text-[10px] uppercase tracking-wider mt-0.5">types</p>
                    </div>
                </div>
            </button>
        `;
    }).join('');

    document.querySelectorAll('.category-card').forEach((button) => {
        button.addEventListener('click', async () => {
            selectedCategoryId = button.dataset.categoryId;
            renderCategories();
            await loadTypesForSelectedCategory();
            renderSelectedCategory();
        });
    });

    renderSelectedCategory();
}

function renderSelectedCategory() {
    const category = categoriesCache.find((entry) => entry.id === selectedCategoryId) || null;
    if (!category) {
        selectedCategoryEmpty?.classList.remove('hidden');
        selectedCategoryPanel?.classList.add('hidden');
        return;
    }
    selectedCategoryEmpty?.classList.add('hidden');
    selectedCategoryPanel?.classList.remove('hidden');
    
    if (selectedCategoryName) selectedCategoryName.textContent = category.name;
    if (selectedCategoryKind) selectedCategoryKind.textContent = getKindLabel(category.kind);
    if (selectedCategoryDescription) selectedCategoryDescription.textContent = category.description || 'Aucune description spécifiée pour ce segment.';
    
    renderTypes();
}

function renderTypes() {
    const category = categoriesCache.find((entry) => entry.id === selectedCategoryId);
    if (!typesList) return;

    if (!category) {
        typesList.innerHTML = '<div class="text-xs font-semibold text-gray-400 text-center py-4">Sélectionnez une catégorie.</div>';
        return;
    }

    if (!typesCache.length) {
        typesList.innerHTML = '<div class="rounded-xl border-2 border-dashed border-gray-100 p-6 text-center text-xs font-semibold text-gray-400">Aucun sous-type lié à ce segment.</div>';
        return;
    }

    typesList.innerHTML = typesCache.map((type) => `
        <div class="rounded-xl border border-gray-100 bg-gray-50/50 p-3 hover:bg-gray-50 transition-colors">
            <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <h4 class="text-sm font-bold text-gray-800 tracking-tight">${escapeHtml(type.name)}</h4>
                        ${type.is_active === false ? '<span class="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 border border-gray-200 uppercase tracking-wide">Désactivé</span>' : ''}
                    </div>
                    <p class="mt-0.5 text-xs font-medium text-gray-500 leading-relaxed">${escapeHtml(type.description || 'Aucune description')}</p>
                </div>
                <div class="flex gap-1 shrink-0">
                    <button data-type-id="${escapeHtml(type.id)}" class="edit-type h-7 px-2 rounded-lg text-xs font-bold text-gray-600 border border-gray-200 bg-white hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm">
                        <i class="fas fa-edit mr-1 text-gray-400"></i>Gérer
                    </button>
                    <button data-type-id="${escapeHtml(type.id)}" class="delete-type h-7 px-2 rounded-lg text-xs font-bold text-red-500 border border-gray-200 bg-white hover:bg-red-50 hover:text-red-600 transition-colors shadow-sm">
                        <i class="fas fa-trash-alt mr-1"></i>Retirer
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.edit-type').forEach((button) => {
        button.addEventListener('click', () => openEditType(button.dataset.typeId));
    });
    document.querySelectorAll('.delete-type').forEach((button) => {
        button.addEventListener('click', () => deleteType(button.dataset.typeId));
    });
}

async function loadCategories() {
    showCategoriesSkeleton();
    try {
        const params = {
            search: categorySearchInput ? categorySearchInput.value.trim() : '',
            kind: categoryKindFilter && categoryKindFilter.value !== 'all' ? categoryKindFilter.value : ''
        };
        const [categoriesResponse, allTypesResponse] = await Promise.all([
            categoriesService.getAll(params),
            categoriesService.getAllTypes()
        ]);
        categoriesCache = categoriesResponse.data || [];
        allTypesCache = allTypesResponse.data || [];

        if (!categoriesCache.some((category) => category.id === selectedCategoryId)) {
            selectedCategoryId = categoriesCache[0]?.id || null;
        }

        renderTypeParentOptions(selectedCategoryId);
        renderCategories();

        if (selectedCategoryId) {
            await loadTypesForSelectedCategory();
        } else {
            typesCache = [];
            renderSelectedCategory();
        }
    } catch (error) {
        if (categoriesList) {
            categoriesList.innerHTML = '<div class="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-xs font-semibold text-red-600">Impossible de charger la taxonomie du menu</div>';
        }
        showToast(error.message || 'Erreur de chargement des catégories', 'error');
    }
}

function showCategoriesSkeleton() {
    if (!categoriesList) return;
    categoriesList.innerHTML = `
        <div class="space-y-3">
            ${Array(5).fill().map(() => `
                <div class="rounded-xl border p-4 bg-white opacity-70 border-gray-100 space-y-3">
                    <div class="flex justify-between"><div class="skeleton h-5 w-40"></div><div class="skeleton h-4 w-10"></div></div>
                    <div class="skeleton h-4 w-3/4"></div>
                    <div class="skeleton h-3 w-1/4"></div>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadTypesForSelectedCategory() {
    if (!selectedCategoryId) {
        typesCache = [];
        renderTypes();
        return;
    }
    try {
        const response = await categoriesService.getTypes(selectedCategoryId);
        typesCache = response.data || [];
        renderTypes();
    } catch (error) {
        typesCache = [];
        renderTypes();
        showToast(error.message || 'Erreur de chargement des types', 'error');
    }
}

function openCreateCategory() {
    resetCategoryForm();
    openModal(categoryModal);
}

function openEditCategory() {
    const category = categoriesCache.find((entry) => entry.id === selectedCategoryId);
    if (!category) {
        showToast('Sélectionnez d\'abord une catégorie', 'warning');
        return;
    }
    editingCategoryId = category.id;
    if (categoryModalTitle) categoryModalTitle.textContent = `Modifier : ${category.name}`;
    document.getElementById('category-name').value = category.name || '';
    document.getElementById('category-kind').value = category.kind || 'plat';
    document.getElementById('category-description').value = category.description || '';
    document.getElementById('category-image-url').value = category.image_url || '';
    document.getElementById('category-active').checked = category.is_active !== false;
    openModal(categoryModal);
}

function openCreateType(prefillCategoryId = selectedCategoryId) {
    if (!categoriesCache.length) {
        showToast('Créez d\'abord une catégorie parente', 'warning');
        return;
    }
    resetTypeForm();
    if (prefillCategoryId) {
        renderTypeParentOptions(prefillCategoryId);
    }
    openModal(typeModal);
}

function openEditType(typeId) {
    const type = typesCache.find((entry) => entry.id === typeId) || allTypesCache.find((entry) => entry.id === typeId);
    if (!type) {
        showToast('Sous-type introuvable', 'error');
        return;
    }
    editingTypeId = type.id;
    if (typeModalTitle) typeModalTitle.textContent = `Modifier : ${type.name}`;
    renderTypeParentOptions(type.categorie_id || selectedCategoryId);
    const typeNameEl = document.getElementById('type-name');
    const typeDescEl = document.getElementById('type-description');
    const typeImageUrlEl = document.getElementById('type-image-url');
    const typeActiveEl = document.getElementById('type-active');
    if (typeNameEl) typeNameEl.value = type.name || '';
    if (typeDescEl) typeDescEl.value = type.description || '';
    if (typeImageUrlEl) typeImageUrlEl.value = type.image_url || '';
    if (typeActiveEl) typeActiveEl.checked = type.is_active !== false;
    openModal(typeModal);
}

async function deleteCategory() {
    const category = categoriesCache.find((entry) => entry.id === selectedCategoryId);
    if (!category) {
        showToast('Sélectionnez une catégorie', 'warning');
        return;
    }
    const confirmed = await confirmDialog(`Supprimer définitivement la catégorie "${category.name}" et ses types rattachés ?`, 'Confirmation');
    if (!confirmed) return;
    try {
        await categoriesService.remove(category.id);
        showToast('Catégorie supprimée avec succès', 'success');
        selectedCategoryId = null;
        await loadCategories();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la suppression', 'error');
    }
}

async function deleteType(typeId) {
    const type = typesCache.find((entry) => entry.id === typeId) || allTypesCache.find((entry) => entry.id === typeId);
    if (!type) {
        showToast('Sous-type introuvable', 'error');
        return;
    }
    const confirmed = await confirmDialog(`Supprimer définitivement le sous-type "${type.name}" ?`, 'Confirmation');
    if (!confirmed) return;
    try {
        await categoriesService.removeType(type.id);
        showToast('Sous-type retiré', 'success');
        await loadCategories();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la suppression', 'error');
    }
}

categoryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
        name: document.getElementById('category-name').value.trim(),
        kind: document.getElementById('category-kind').value,
        description: document.getElementById('category-description').value.trim(),
        image_url: document.getElementById('category-image-url').value.trim(),
        is_active: document.getElementById('category-active').checked
    };

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    const imageFile = document.getElementById('category-image-file').files[0];
    if (imageFile) formData.append('image', imageFile);

    try {
        if (editingCategoryId) {
            await categoriesService.update(editingCategoryId, formData);
            showToast('Catégorie mise à jour', 'success');
        } else {
            const response = await categoriesService.create(formData);
            selectedCategoryId = response.data?.id || selectedCategoryId;
            showToast('Catégorie créée', 'success');
        }
        closeModal(categoryModal);
        await loadCategories();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
});

typeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const typeNameEl = document.getElementById('type-name');
    const typeDescEl = document.getElementById('type-description');
    const typeImageUrlEl = document.getElementById('type-image-url');
    const typeActiveEl = document.getElementById('type-active');

    const payload = {
        categorie_id: typeParentSelect ? typeParentSelect.value : (document.getElementById('type-parent-category-id')?.value || ''),
        name: typeNameEl ? typeNameEl.value.trim() : '',
        description: typeDescEl ? typeDescEl.value.trim() : '',
        image_url: typeImageUrlEl ? typeImageUrlEl.value.trim() : '',
        is_active: !!(typeActiveEl && typeActiveEl.checked)
    };

    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
    const imageFile = document.getElementById('type-image-file').files[0];
    if (imageFile) formData.append('image', imageFile);

    try {
        if (editingTypeId) {
            await categoriesService.updateType(editingTypeId, formData);
            showToast('Sous-type mis à jour', 'success');
        } else {
            await categoriesService.createType(formData);
            selectedCategoryId = payload.categorie_id;
            showToast('Sous-type créé', 'success');
        }
        closeModal(typeModal);
        await loadCategories();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
});

newCategoryBtn?.addEventListener('click', openCreateCategory);
editCategoryBtn?.addEventListener('click', openEditCategory);
deleteCategoryBtn?.addEventListener('click', deleteCategory);
newTypeBtn?.addEventListener('click', () => openCreateType(selectedCategoryId));
addTypeToCategoryBtn?.addEventListener('click', () => openCreateType(selectedCategoryId));

closeCategoryModalBtn?.addEventListener('click', () => closeModal(categoryModal));
cancelCategoryModalBtn?.addEventListener('click', () => closeModal(categoryModal));
closeTypeModalBtn?.addEventListener('click', () => closeModal(typeModal));
cancelTypeModalBtn?.addEventListener('click', () => closeModal(typeModal));

categoryModal?.addEventListener('click', (event) => { if (event.target === categoryModal) closeModal(categoryModal); });
typeModal?.addEventListener('click', (event) => { if (event.target === typeModal) closeModal(typeModal); });

const debouncedLoadCategories = debounce(loadCategories, 300);
categorySearchInput?.addEventListener('input', debouncedLoadCategories);
categoryKindFilter?.addEventListener('change', loadCategories);
refreshCategoriesBtn?.addEventListener('click', loadCategories);

await loadCategories();
