import { getClientViewFromSearch } from '../../../app.js';
import { showToast } from '../../../shared/utils/index.js';
import { navigation } from '../components/navigation.js';
import { sessionManager } from '../services/sessionService.js';
import { store } from '../store/clientStore.js';

navigation.init();

try {
    const session = await sessionManager.initFromUrl();

    if (!session) {
        const mainContent = document.getElementById('main-content');

        if (mainContent) {
            mainContent.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-qrcode text-6xl text-primary mb-4"></i>
                    <h2 class="text-xl font-semibold mb-2">Bienvenue au Bistrot Parisien</h2>
                    <p class="text-gray-600">Scannez le QR code sur votre table pour commencer</p>
                </div>
            `;
        }
    } else {
        store.set('currentView', getClientViewFromSearch());
    }
} catch (error) {
    console.error('Erreur initialisation client:', error);
    showToast('Erreur de connexion au serveur', 'error');
}

