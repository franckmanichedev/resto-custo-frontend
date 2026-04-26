import { requireRole as requireRoleGuard, normalizeRole, getCurrentUserRole } from './authGuard.js';

export const requireRole = (allowedRoles, options = {}) => requireRoleGuard(allowedRoles, options);

export const getActiveRole = () => getCurrentUserRole();

export const isRoleAllowed = (allowedRoles = [], role = getCurrentUserRole()) => {
    const normalizedRole = normalizeRole(role);

    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return Boolean(normalizedRole);
    }

    return allowedRoles
        .map((entry) => normalizeRole(entry))
        .filter(Boolean)
        .includes(normalizedRole);
};

export default requireRole;
