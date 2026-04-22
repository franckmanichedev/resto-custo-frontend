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

async function loadCompositions() {
    try {
        const search = searchInput.value.trim();
        const response = await compositionsService.getAll(search ? { search } : {});
        renderCompositions(response.data || []);
    } catch (error) {
        showToast(error.message || 'Erreur de chargement', 'error');
        compositionsList.innerHTML = '<div class="text-center py-8 text-red-500">Erreur de chargement</div>';
    }
}

function renderCompositions(compositions) {
    if (!compositions.length) {
        compositionsList.innerHTML = '<div class="text-center py-8 text-gray-500">Aucune composition trouvée</div>';
        return;
    }

    compositionsList.innerHTML = compositions.map((composition) => `
        <div class="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
            <div class="flex-1">
                <div class="flex items-center gap-2">
                    <span class="font-medium">${escapeHtml(composition.name)}</span>
                    ${composition.is_allergen ? '<span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Allergène</span>' : ''}
                </div>
                ${composition.description ? `<p class="text-sm text-gray-500 mt-1">${escapeHtml(composition.description)}</p>` : ''}
                <p class="text-xs text-gray-400 mt-1">ID: ${escapeHtml(composition.id)}</p>
            </div>
            <button class="delete-comp text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm transition-colors" data-id="${escapeHtml(composition.id)}">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');

    document.querySelectorAll('.delete-comp').forEach((button) => {
        button.addEventListener('click', async () => {
            const confirmed = await confirmDialog('Supprimer cette composition ? Elle sera retirée des plats associés.', 'Confirmation');
            if (!confirmed) return;

            try {
                await compositionsService.remove(button.dataset.id);
                showToast('Composition supprimée', 'success');
                await loadCompositions();
            } catch (error) {
                showToast(error.message || 'Erreur de suppression', 'error');
            }
        });
    });
}

compositionForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('comp-name').value.trim();
    const description = document.getElementById('comp-description').value.trim();
    const isAllergen = document.getElementById('comp-allergen').checked;

    if (!name) {
        showToast('Le nom est requis', 'warning');
        return;
    }

    try {
        await compositionsService.create({ name, description, is_allergen: isAllergen });
        compositionForm.reset();
        showToast('Composition ajoutée', 'success');
        await loadCompositions();
    } catch (error) {
        showToast(error.message || 'Erreur lors de la création', 'error');
    }
});

searchInput?.addEventListener('input', debounce(loadCompositions, 300));
refreshBtn?.addEventListener('click', loadCompositions);

await loadCompositions();
