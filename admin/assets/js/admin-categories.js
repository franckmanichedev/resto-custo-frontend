import { auth } from '../../../shared/js/auth.js';
import { api } from '../../../shared/js/api.js';
import { showToast, confirmDialog, escapeHtml, debounce } from '../../../shared/js/utils.js';

if (!auth.isAdmin()) {
    window.location.href = './index.html';
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
    categoryModalTitle.textContent = 'Nouvelle categorie';
    categoryForm.reset();
    document.getElementById('category-kind').value = 'plat';
    document.getElementById('category-active').checked = true;
}

function resetTypeForm() {
    editingTypeId = null;
    typeModalTitle.textContent = 'Nouveau type';
    typeForm.reset();
    document.getElementById('type-active').checked = true;
    renderTypeParentOptions(selectedCategoryId);
}

function openModal(modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal(modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function renderTypeParentOptions(selectedId = '') {
    typeParentSelect.innerHTML = categoriesCache.map((category) => `
        <option value="${escapeHtml(category.id)}" ${category.id === selectedId ? 'selected' : ''}>
            ${escapeHtml(category.name)} (${getKindLabel(category.kind)})
        </option>
    `).join('');
}

function renderCategories() {
    const selectedId = selectedCategoryId;

    if (!categoriesCache.length) {
        categoriesList.innerHTML = '<div class="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">Aucune categorie disponible</div>';
        renderSelectedCategory();
        return;
    }

    categoriesList.innerHTML = categoriesCache.map((category) => {
        const typeCount = allTypesCache.filter((type) => type.categorie_id === category.id).length;
        const isSelected = category.id === selectedId;

        return `
            <button data-category-id="${escapeHtml(category.id)}" class="category-card w-full text-left rounded-2xl border p-4 shadow-sm transition-all ${isSelected ? 'border-yellow-400 bg-yellow-50 shadow-md' : 'border-gray-100 bg-white hover:border-yellow-200 hover:shadow-md'}">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="text-lg font-semibold text-gray-800">${escapeHtml(category.name)}</h3>
                            <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">${escapeHtml(getKindLabel(category.kind))}</span>
                            ${category.is_active === false ? '<span class="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Inactive</span>' : ''}
                        </div>
                        <p class="mt-2 text-sm text-gray-500 line-clamp-2">${escapeHtml(category.description || 'Aucune description')}</p>
                    </div>
                    <div class="text-right text-sm text-gray-500">
                        <p class="font-semibold text-gray-700">${typeCount}</p>
                        <p>type(s)</p>
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
        selectedCategoryEmpty.classList.remove('hidden');
        selectedCategoryPanel.classList.add('hidden');
        return;
    }

    selectedCategoryEmpty.classList.add('hidden');
    selectedCategoryPanel.classList.remove('hidden');
    selectedCategoryName.textContent = category.name;
    selectedCategoryKind.textContent = getKindLabel(category.kind);
    selectedCategoryDescription.textContent = category.description || 'Aucune description';

    renderTypes();
}

function renderTypes() {
    const category = categoriesCache.find((entry) => entry.id === selectedCategoryId);
    if (!category) {
        typesList.innerHTML = '<div class="text-sm text-gray-500">Selectionnez une categorie.</div>';
        return;
    }

    if (!typesCache.length) {
        typesList.innerHTML = '<div class="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">Aucun type lie a cette categorie.</div>';
        return;
    }

    typesList.innerHTML = typesCache.map((type) => `
        <div class="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <h4 class="font-semibold text-gray-800">${escapeHtml(type.name)}</h4>
                        ${type.is_active === false ? '<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Inactif</span>' : ''}
                    </div>
                    <p class="mt-1 text-sm text-gray-500">${escapeHtml(type.description || 'Aucune description')}</p>
                </div>
                <div class="flex gap-2">
                    <button data-type-id="${escapeHtml(type.id)}" class="edit-type px-3 py-2 rounded-xl text-sm text-primary hover:bg-white transition-colors">
                        <i class="fas fa-edit mr-1"></i>Modifier
                    </button>
                    <button data-type-id="${escapeHtml(type.id)}" class="delete-type px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-white transition-colors">
                        <i class="fas fa-trash-alt mr-1"></i>Supprimer
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
    try {
        const params = {
            search: categorySearchInput.value.trim(),
            kind: categoryKindFilter.value === 'all' ? '' : categoryKindFilter.value
        };

        const [categoriesResponse, allTypesResponse] = await Promise.all([
            api.categories.getAll(params),
            api.categories.getAllTypes()
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
        categoriesList.innerHTML = '<div class="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-red-600">Erreur de chargement des categories</div>';
        showToast(error.message || 'Erreur de chargement des categories', 'error');
    }
}

async function loadTypesForSelectedCategory() {
    if (!selectedCategoryId) {
        typesCache = [];
        renderTypes();
        return;
    }

    try {
        const response = await api.categories.getTypes(selectedCategoryId);
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
        showToast('Selectionnez une categorie', 'warning');
        return;
    }

    editingCategoryId = category.id;
    categoryModalTitle.textContent = `Modifier: ${category.name}`;
    document.getElementById('category-name').value = category.name || '';
    document.getElementById('category-kind').value = category.kind || 'plat';
    document.getElementById('category-description').value = category.description || '';
    document.getElementById('category-active').checked = category.is_active !== false;
    openModal(categoryModal);
}

function openCreateType(prefillCategoryId = selectedCategoryId) {
    if (!categoriesCache.length) {
        showToast('Creez d abord une categorie', 'warning');
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
        showToast('Type introuvable', 'error');
        return;
    }

    editingTypeId = type.id;
    typeModalTitle.textContent = `Modifier: ${type.name}`;
    renderTypeParentOptions(type.categorie_id || selectedCategoryId);
    document.getElementById('type-name').value = type.name || '';
    document.getElementById('type-description').value = type.description || '';
    document.getElementById('type-active').checked = type.is_active !== false;
    openModal(typeModal);
}

async function deleteCategory() {
    const category = categoriesCache.find((entry) => entry.id === selectedCategoryId);
    if (!category) {
        showToast('Selectionnez une categorie', 'warning');
        return;
    }

    const confirmed = await confirmDialog(`Supprimer la categorie "${category.name}" ?`, 'Confirmation');
    if (!confirmed) return;

    try {
        await api.categories.delete(category.id);
        showToast('Categorie supprimee', 'success');
        selectedCategoryId = null;
        await loadCategories();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la suppression', 'error');
    }
}

async function deleteType(typeId) {
    const type = typesCache.find((entry) => entry.id === typeId) || allTypesCache.find((entry) => entry.id === typeId);
    if (!type) {
        showToast('Type introuvable', 'error');
        return;
    }

    const confirmed = await confirmDialog(`Supprimer le type "${type.name}" ?`, 'Confirmation');
    if (!confirmed) return;

    try {
        await api.categories.deleteType(type.id);
        showToast('Type supprime', 'success');
        await loadCategories();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la suppression', 'error');
    }
}

categoryForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
        name: document.getElementById('category-name').value.trim(),
        kind: document.getElementById('category-kind').value,
        description: document.getElementById('category-description').value.trim(),
        is_active: document.getElementById('category-active').checked
    };

    try {
        if (editingCategoryId) {
            await api.categories.update(editingCategoryId, payload);
            showToast('Categorie mise a jour', 'success');
        } else {
            const response = await api.categories.create(payload);
            selectedCategoryId = response.data?.id || selectedCategoryId;
            showToast('Categorie creee', 'success');
        }

        closeModal(categoryModal);
        await loadCategories();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
});

typeForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
        categorie_id: typeParentSelect.value,
        name: document.getElementById('type-name').value.trim(),
        description: document.getElementById('type-description').value.trim(),
        is_active: document.getElementById('type-active').checked
    };

    try {
        if (editingTypeId) {
            await api.categories.updateType(editingTypeId, payload);
            showToast('Type mis a jour', 'success');
        } else {
            await api.categories.createType(payload);
            selectedCategoryId = payload.categorie_id;
            showToast('Type cree', 'success');
        }

        closeModal(typeModal);
        await loadCategories();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
    }
});

newCategoryBtn.addEventListener('click', openCreateCategory);
editCategoryBtn.addEventListener('click', openEditCategory);
deleteCategoryBtn.addEventListener('click', deleteCategory);
newTypeBtn.addEventListener('click', () => openCreateType(selectedCategoryId));
addTypeToCategoryBtn.addEventListener('click', () => openCreateType(selectedCategoryId));
closeCategoryModalBtn.addEventListener('click', () => closeModal(categoryModal));
cancelCategoryModalBtn.addEventListener('click', () => closeModal(categoryModal));
closeTypeModalBtn.addEventListener('click', () => closeModal(typeModal));
cancelTypeModalBtn.addEventListener('click', () => closeModal(typeModal));

categoryModal.addEventListener('click', (event) => {
    if (event.target === categoryModal) closeModal(categoryModal);
});

typeModal.addEventListener('click', (event) => {
    if (event.target === typeModal) closeModal(typeModal);
});

const debouncedLoadCategories = debounce(loadCategories, 300);
categorySearchInput.addEventListener('input', debouncedLoadCategories);
categoryKindFilter.addEventListener('change', loadCategories);
refreshCategoriesBtn.addEventListener('click', loadCategories);

document.getElementById('logout-btn').addEventListener('click', async () => {
    await auth.logout();
    window.location.href = './index.html';
});

await loadCategories();
