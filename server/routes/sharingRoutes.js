/**
 * sharingRoutes.js
 *
 * Express router for project sharing and activity endpoints.
 *
 * Mount at the application level:
 *   app.use('/api', sharingRouter(services));
 *
 * Routes:
 *   GET    /api/projects/shared                       – list shared-with-me projects
 *   GET    /api/projects/:id/members                  – list project members
 *   POST   /api/projects/:id/members                  – add a member (owner only)
 *   PATCH  /api/projects/:id/members/:userId          – change member role (owner only)
 *   DELETE /api/projects/:id/members/:userId          – remove member (owner only)
 *   GET    /api/projects/:id/activity                 – project activity log
 */

import { Router } from 'express';
import { createSharingController }      from '../controllers/SharingController.js';
import { requireProjectAccess }         from '../middleware/requireProjectAccess.js';
import { requireProjectPermission }     from '../middleware/requireProjectPermission.js';

/**
 * @param {{
 *   permissionService: import('../services/PermissionService.js').PermissionService,
 *   sharingService:    import('../services/SharingService.js').SharingService,
 *   activityService:   import('../services/ActivityService.js').ActivityService
 * }} services
 * @returns {import('express').Router}
 */
export function sharingRouter(services) {
    const { permissionService, sharingService, activityService } = services;

    const {
        getMembers,
        addMember,
        updateMemberRole,
        removeMember,
        getSharedProjects,
        getActivity,
    } = createSharingController({ sharingService, activityService });

    const router = Router();

    // ── Shared-with-me ────────────────────────────────────────────────
    // Must be registered BEFORE /:id routes to avoid "shared" being
    // treated as a UUID parameter.
    router.get('/projects/shared', getSharedProjects);

    // ── Member management ────────────────────────────────────────────
    router.get(
        '/projects/:id/members',
        requireProjectAccess(permissionService),
        getMembers
    );

    router.post(
        '/projects/:id/members',
        requireProjectPermission(permissionService, 'manage'),
        addMember
    );

    router.patch(
        '/projects/:id/members/:userId',
        requireProjectPermission(permissionService, 'manage'),
        updateMemberRole
    );

    router.delete(
        '/projects/:id/members/:userId',
        requireProjectPermission(permissionService, 'manage'),
        removeMember
    );

    // ── Activity log ─────────────────────────────────────────────────
    router.get(
        '/projects/:id/activity',
        requireProjectAccess(permissionService),
        getActivity
    );

    return router;
}
