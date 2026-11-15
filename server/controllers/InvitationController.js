/**
 * InvitationController.js
 *
 * Express controller methods for project invitation endpoints.
 *
 * Dependency injection pattern: call `createInvitationController` with
 * the required services and destructure the returned handler functions.
 *
 * Route parameters expected:
 *   req.params.id           – project UUID
 *   req.params.token        – raw invitation token (URL-safe base64)
 *   req.params.invitationId – invitation UUID
 *   req.user.id             – authenticated user UUID
 */

/**
 * @param {{
 *   invitationService: import('../services/InvitationService.js').InvitationService
 * }} services
 */
export function createInvitationController({ invitationService }) {
    // ----------------------------------------------------------------
    // POST /api/projects/:id/invitations
    // ----------------------------------------------------------------

    /**
     * Create a new invitation for an email address.
     * Body: { email: string, role: 'viewer'|'editor' }
     * Requires MANAGE (owner) access.
     *
     * @type {import('express').RequestHandler}
     */
    const createInvitation = async (req, res, next) => {
        try {
            const projectId = req.params.id;
            const createdBy = req.user.id;
            const { email, role } = req.body;

            if (!email || typeof email !== 'string') {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Body must include a valid email address.',
                });
            }

            if (!role || !['viewer', 'editor'].includes(role)) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: "Body must include role: 'viewer' or 'editor'.",
                });
            }

            const result = await invitationService.createInvitation(
                projectId,
                email,
                role,
                createdBy
            );

            // NOTE: The raw `token` must be transmitted to the invitee
            // (e.g. via email). Return it in the response so the server
            // layer can forward it to an email service.
            res.status(201).json({
                invitation: {
                    invitationId: result.invitationId,
                    expiresAt:    result.expiresAt,
                    // token is intentionally included so the caller can send it;
                    // it is NOT stored in the DB.
                    token: result.token,
                },
            });
        } catch (err) {
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // GET /api/invitations
    // ----------------------------------------------------------------

    /**
     * Return all pending invitations addressed to the authenticated user.
     *
     * @type {import('express').RequestHandler}
     */
    const getUserInvitations = async (req, res, next) => {
        try {
            const userId      = req.user.id;
            const invitations = await invitationService.getUserInvitations(userId);
            res.json({ invitations });
        } catch (err) {
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // POST /api/invitations/:token/accept
    // ----------------------------------------------------------------

    /**
     * Accept an invitation using the raw token from the invitation link.
     *
     * @type {import('express').RequestHandler}
     */
    const acceptInvitation = async (req, res, next) => {
        try {
            const token  = req.params.token;
            const userId = req.user.id;

            const result = await invitationService.acceptInvitation(token, userId);
            res.json({ result });
        } catch (err) {
            if (err.message?.includes('INVITATION_NOT_FOUND')) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Invitation is invalid, expired, or already used.',
                });
            }
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // POST /api/invitations/:token/decline
    // ----------------------------------------------------------------

    /**
     * Decline an invitation using the raw token.
     *
     * @type {import('express').RequestHandler}
     */
    const declineInvitation = async (req, res, next) => {
        try {
            const token  = req.params.token;
            const userId = req.user.id;

            await invitationService.declineInvitation(token, userId);
            res.status(204).send();
        } catch (err) {
            if (err.message?.includes('INVITATION_NOT_FOUND')) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Invitation is invalid, expired, or already used.',
                });
            }
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // DELETE /api/projects/:id/invitations/:invitationId
    // ----------------------------------------------------------------

    /**
     * Revoke a pending invitation (owner action).
     * Requires MANAGE (owner) access.
     *
     * @type {import('express').RequestHandler}
     */
    const revokeInvitation = async (req, res, next) => {
        try {
            const invitationId = req.params.invitationId;
            const revokedBy    = req.user.id;

            await invitationService.revokeInvitation(invitationId, revokedBy);
            res.status(204).send();
        } catch (err) {
            if (err.message?.includes('not found')) {
                return res.status(404).json({ error: 'Not Found', message: err.message });
            }
            if (err.message?.includes('cannot revoke')) {
                return res.status(409).json({ error: 'Conflict', message: err.message });
            }
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // GET /api/projects/:id/invitations
    // ----------------------------------------------------------------

    /**
     * Return all invitations for a project (any status).
     * Requires MANAGE (owner) access.
     *
     * @type {import('express').RequestHandler}
     */
    const getProjectInvitations = async (req, res, next) => {
        try {
            const projectId   = req.params.id;
            const invitations = await invitationService.getProjectInvitations(projectId);
            res.json({ invitations });
        } catch (err) {
            next(err);
        }
    };

    return {
        createInvitation,
        getUserInvitations,
        acceptInvitation,
        declineInvitation,
        revokeInvitation,
        getProjectInvitations,
    };
}
