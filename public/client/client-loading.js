import { bindChrome, buildUrl, showToast, startSession } from './client-core.js';

const resolveReturnTarget = () => {
    const raw = new URLSearchParams(window.location.search).get('return_to');
    if (!raw || raw.startsWith('http://') || raw.startsWith('https://')) {
        return buildUrl('index');
    }
    return raw;
};

const statusNode = document.getElementById('loadingStatus');
const hintNode = document.getElementById('loadingHint');
const loaderContainer = document.getElementById('loaderContainer');
const menuButton = document.getElementById('seeMenuBtn');
const buttonContainer = document.getElementById('buttonContainer');
const retryButton = document.getElementById('retryBtn');
const retryContainer = document.getElementById('retryContainer');
const target = resolveReturnTarget();

bindChrome();

menuButton?.addEventListener('click', () => {
    window.location.href = target;
});

retryButton?.addEventListener('click', () => {
    window.location.reload();
});

try {
    statusNode.textContent = 'Creation de votre session en cours...';
    hintNode.textContent = 'Nous verifions la table scannee avant de charger le menu.';
    await startSession();
    statusNode.textContent = 'Votre table est prete.';
    hintNode.textContent = 'Redirection vers les menus dans un instant.';
    loaderContainer?.classList.add('opacity-70');
    buttonContainer?.classList.remove('hidden');
    retryContainer?.classList.add('hidden');
    setTimeout(() => {
        window.location.href = target;
    }, 700);
} catch (error) {
    statusNode.textContent = 'Impossible de demarrer cette table.';
    hintNode.textContent = error.message || 'Verifiez le QR code ou la connexion avec le serveur.';
    buttonContainer?.classList.add('hidden');
    retryContainer?.classList.remove('hidden');
    showToast(error.message || 'Erreur de creation de session', 'error');
}
