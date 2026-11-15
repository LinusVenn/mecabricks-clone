/**
 * requireProjectPermission.js
 *
 * Express middleware factory that checks whether the authenticated user
 * has a specific permission on the project identified by `req.params.id`.
 *
 * Use this instead of `requireProjectAccess` when you need a permission
 * stronger than VIEW (e.g. EDIT or MANAGE).
 *
 * Prerequisites:
 *   - An auth middleware must have already populated `req.user.id`.
 *   - The route must expose the project UUID as `:id` (or override via options).
 *   - You may (but do not need to) run `requireProjectAccess` first; this
 *     middleware calls `PermissionService` independently.
 *
 * Usage:
 *   import { requireProjectPermission } from '../middleware/requireProjectPermission.js';
 *   router.patch('/:id/…', requireProjectPermission(permissionService, 'edit'), handler);
 */

/**
 * @typedef {'view'|'edit'|'manage'|'delete'|'restoreVersion'} RequiredPermission
 */

/**
 * @typedef {object} RequireProjectPermissionOptions
 * @property {string} [paramName='id']  Route param containing the project UUID.
 */

/**
 * Creates a middleware that checks the authenticated user has the given
 * permission on the project.
 *
 * @param {import('../services/PermissionService.js').PermissionService} permissionService
 * @param {RequiredPermission} requiredPermission
 * @param {RequireProjectPermissionOptions} [options]
 * @returns {import('express').RequestHandler}
 */
export function requireProjectPermission(permissionService, requiredPermission, options = {}) {
    const validPermissions = ['view', 'edit', 'manage', 'delete', 'restoreVersion'];

    if (!validPermissions.includes(requiredPermission)) {
        throw new Error(
            `requireProjectPermission: invalid permission '${requiredPermission}'. ` +
            `Must be one of: ${validPermissions.join(', ')}.`
        );
    }

    const paramName = options.paramName ?? 'id';

    return async function checkPermission(req, res, next) {
        try {
            const userId    = req.user?.id;
            const projectId = req.params[paramName];

            if (!userId) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Authentication required.',
                });
            }

            if (!projectId) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: `Route parameter '${paramName}' is missing.`,
                });
            }

            // Use assertCan so permission logic stays in one place.
            try {
                await permissionService.assertCan(requiredPermission, userId, projectId);
            } catch (permErr) {
                if (permErr.statusCode === 403) {
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: permErr.message,
                    });
                }
                throw permErr;
            }

            // Resolve and attach the full role for downstream handlers.
            if (!req.projectRole) {
                req.projectRole = await permissionService.getRole(userId, projectId);
            }

            next();
        } catch (err) {
            next(err);
        }
    };
}
