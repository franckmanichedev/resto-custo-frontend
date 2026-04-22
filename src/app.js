export const APP_CONFIG = {
    brandName: 'Resto QRCode',
    restaurantName: 'Le Bistrot Parisien',
    adminLoginPath: '/admin/index.html',
    clientAppPath: '/client/index.html'
};

export const CLIENT_VIEWS = ['menu', 'cart', 'track', 'profile'];

export function getClientViewFromSearch(search = window.location.search) {
    const params = new URLSearchParams(search);
    const requestedView = params.get('view');
    return CLIENT_VIEWS.includes(requestedView) ? requestedView : 'menu';
}

export function updateClientViewInUrl(view, search = window.location.search) {
    const params = new URLSearchParams(search);

    if (view && view !== 'menu') {
        params.set('view', view);
    } else {
        params.delete('view');
    }

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
}

export function buildClientIndexUrl(view = 'menu', search = window.location.search) {
    const params = new URLSearchParams(search);

    if (view && view !== 'menu') {
        params.set('view', view);
    } else {
        params.delete('view');
    }

    const query = params.toString();
    return `./index.html${query ? `?${query}` : ''}`;
}
