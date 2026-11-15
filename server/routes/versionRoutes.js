/**
 * versionRoutes.js
 *
 * Express router for project version snapshot endpoints.
 *
 * Mount at the application level:
 *   app.use('/api', versionRouter(services));
 *
 * Routes:
 *   GET  /api/projects/:id/versions                       – list versions (any member)
 *   POST /api/projects/:id/versions                       – create version (owner or editor)
 *   GET  /api/projects/:id/versions/:versionId            – get version + data (any member)
 *   POST /api/projects/:id/versions/:versionId/restore    – restore version (owner only)
 */

import { Router } from 'express';
import { createVersionController }      from '../controllers/VersionController.js';
import { requireProjectAccess }         from '../middleware/requireProjectAccess.js';
import { requireProjectPermission }     from '../middleware/requireProjectPermission.js';

/**
 * @param {{
 *   permissionService: import('../services/PermissionService.js').PermissionService,
 *   versionService:    import('../services/VersionService.js').VersionService
 * }} services
 * @returns {import('express').Router}
 */
export function versionRouter(services) {
    const { permissionService, versionService } = services;

    const {
        getVersions,
        createVersion,
        getVersion,
        restoreVersion,
    } = createVersionController({ versionService });

    const router = Router();

    // ── List versions (viewer+) ───────────────────────────────────────
    router.get(
        '/projects/:id/versions',
        requireProjectAccess(permissionService),
        getVersions
    );

    // ── Create version snapshot (editor+) ────────────────────────────
    router.post(
        '/projects/:id/versions',
        requireProjectPermission(permissionService, 'edit'),
        createVersion
    );

    // ── Get single version including data (viewer+) ───────────────────
    router.get(
        '/projects/:id/versions/:versionId',
        requireProjectAccess(permissionService),
        getVersion
    );

    // ── Restore version (owner only) ─────────────────────────────────
    router.post(
        '/projects/:id/versions/:versionId/restore',
        requireProjectPermission(permissionService, 'manage'),
        restoreVersion
    );

    return router;
}
