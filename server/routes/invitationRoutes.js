/**
 * invitationRoutes.js
 *
 * Express router for project invitation endpoints.
 *
 * Mount at the application level:
 *   app.use('/api', invitationRouter(services));
 *
 * Routes:
 *   GET    /api/invitations                                    – pending invites for current user
 *   POST   /api/invitations/:token/accept                      – accept invitation by token
 *   POST   /api/invitations/:token/decline                     – decline invitation by token
 *   POST   /api/projects/:id/invitations                       – create invitation (owner only)
 *   GET    /api/projects/:id/invitations                       – list project invitations (owner)
 *   DELETE /api/projects/:id/invitations/:invitationId         – revoke invitation (owner only)
 */

import { Router } from 'express';
import { createInvitationController }   from '../controllers/InvitationController.js';
import { requireProjectPermission }     from '../middleware/requireProjectPermission.js';

/**
 * @param {{
 *   permissionService:  import('../services/PermissionService.js').PermissionService,
 *   invitationService:  import('../services/InvitationService.js').InvitationService
 * }} services
 * @returns {import('express').Router}
 */
export function invitationRouter(services) {
    const { permissionService, invitationService } = services;

    const {
        createInvitation,
        getUserInvitations,
        acceptInvitation,
        declineInvitation,
        revokeInvitation,
        getProjectInvitations,
    } = createInvitationController({ invitationService });

    const router = Router();

    // ── User-scoped routes ───────────────────────────────────────────
    // Register before /:id routes to avoid token being treated as UUID.
    router.get('/invitations', getUserInvitations);
    router.post('/invitations/:token/accept',  acceptInvitation);
    router.post('/invitations/:token/decline', declineInvitation);

    // ── Project-scoped routes (owner only) ───────────────────────────
    router.post(
        '/projects/:id/invitations',
        requireProjectPermission(permissionService, 'manage'),
        createInvitation
    );

    router.get(
        '/projects/:id/invitations',
        requireProjectPermission(permissionService, 'manage'),
        getProjectInvitations
    );

    router.delete(
        '/projects/:id/invitations/:invitationId',
        requireProjectPermission(permissionService, 'manage'),
        revokeInvitation
    );

    return router;
}
