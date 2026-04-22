import { buildClientIndexUrl } from '../../../app.js';

const view = document.body.dataset.clientView || 'menu';
window.location.replace(buildClientIndexUrl(view));
