/**
 * requireProjectAccess.js
 *
 * Express middleware factory that verifies the authenticated user has
 * at least VIEW access to the project identified by `req.params.id`.
 *
 * On success the resolved role is attached to `req.projectRole` so
 * downstream handlers can inspect it without making another DB call.
 *
 * Prerequisites:
 *   - An auth middleware must have already populated `req.user.id`.
 *   - The route must expose the project UUID as `:id` (or override via options).
 *
 * Usage:
 *   import { requireProjectAccess } from '../middleware/requireProjectAccess.js';
 *   router.get('/:id/…', requireProjectAccess(permissionService), handler);
 */

/**
 * @typedef {object} RequireProjectAccessOptions
 * @property {string} [paramName='id']  Name of the route param containing the project UUID.
 */

/**
 * Creates a middleware that checks the authenticated user can VIEW the project.
 *
 * @param {import('../services/PermissionService.js').PermissionService} permissionService
 * @param {RequireProjectAccessOptions} [options]
 * @returns {import('express').RequestHandler}
 */
export function requireProjectAccess(permissionService, options = {}) {
    const paramName = options.paramName ?? 'id';

    return async function checkProjectAccess(req, res, next) {
        try {
            const userId    = req.user?.id;
            const projectId = req.params[paramName];

            // Guard: auth middleware must have run first.
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

            const role = await permissionService.getRole(userId, projectId);

            if (role === null) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have access to this project.',
                });
            }

            // Attach role to request for downstream use.
            req.projectRole = role;

            next();
        } catch (err) {
            next(err);
        }
    };
}
