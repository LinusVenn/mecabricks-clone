/**
 * SharingController.js
 *
 * Express controller methods for project sharing and activity endpoints.
 *
 * Dependency injection pattern: call `createSharingController` with the
 * required services and destructure the returned handler functions.
 *
 * Route parameters expected:
 *   req.params.id       – project UUID
 *   req.params.userId   – target member UUID (updateMemberRole, removeMember)
 *   req.user.id         – authenticated user UUID (set by auth middleware)
 *   req.projectRole     – resolved role (set by requireProjectAccess middleware)
 */

/**
 * @param {{
 *   sharingService:  import('../services/SharingService.js').SharingService,
 *   activityService: import('../services/ActivityService.js').ActivityService
 * }} services
 */
export function createSharingController({ sharingService, activityService }) {
    // ----------------------------------------------------------------
    // GET /api/projects/:id/members
    // ----------------------------------------------------------------

    /**
     * Return all members of the project (including the owner).
     * Requires at least VIEW access.
     *
     * @type {import('express').RequestHandler}
     */
    const getMembers = async (req, res, next) => {
        try {
            const members = await sharingService.getMembers(req.params.id);
            res.json({ members });
        } catch (err) {
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // POST /api/projects/:id/members
    // ----------------------------------------------------------------

    /**
     * Add a user as a project member.
     * Body: { userId: string, role: 'viewer'|'editor' }
     * Requires MANAGE (owner) access.
     *
     * @type {import('express').RequestHandler}
     */
    const addMember = async (req, res, next) => {
        try {
            const projectId = req.params.id;
            const addedBy   = req.user.id;
            const { userId, role } = req.body;

            if (!userId || typeof userId !== 'string') {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Body must include a valid userId (string).',
                });
            }

            if (!role || !['viewer', 'editor'].includes(role)) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: "Body must include role: 'viewer' or 'editor'.",
                });
            }

            const member = await sharingService.addMember(projectId, userId, role, addedBy);
            res.status(201).json({ member });
        } catch (err) {
            if (err.message?.includes('already a member')) {
                return res.status(409).json({ error: 'Conflict', message: err.message });
            }
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // PATCH /api/projects/:id/members/:userId
    // ----------------------------------------------------------------

    /**
     * Update the role of an existing project member.
     * Body: { role: 'viewer'|'editor' }
     * Requires MANAGE (owner) access.
     *
     * @type {import('express').RequestHandler}
     */
    const updateMemberRole = async (req, res, next) => {
        try {
            const projectId  = req.params.id;
            const targetUser = req.params.userId;
            const updatedBy  = req.user.id;
            const { role }   = req.body;

            if (!role || !['viewer', 'editor'].includes(role)) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: "Body must include role: 'viewer' or 'editor'.",
                });
            }

            const updated = await sharingService.updateMemberRole(
                projectId,
                targetUser,
                role,
                updatedBy
            );
            res.json({ member: updated });
        } catch (err) {
            if (err.message?.includes('not found')) {
                return res.status(404).json({ error: 'Not Found', message: err.message });
            }
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // DELETE /api/projects/:id/members/:userId
    // ----------------------------------------------------------------

    /**
     * Remove a member from a project.
     * Requires MANAGE (owner) access.
     *
     * @type {import('express').RequestHandler}
     */
    const removeMember = async (req, res, next) => {
        try {
            const projectId  = req.params.id;
            const targetUser = req.params.userId;
            const removedBy  = req.user.id;

            await sharingService.removeMember(projectId, targetUser, removedBy);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // GET /api/projects/shared
    // ----------------------------------------------------------------

    /**
     * Return projects where the authenticated user is a member but not owner.
     *
     * @type {import('express').RequestHandler}
     */
    const getSharedProjects = async (req, res, next) => {
        try {
            const userId         = req.user.id;
            const sharedProjects = await sharingService.getSharedProjects(userId);
            res.json({ projects: sharedProjects });
        } catch (err) {
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // GET /api/projects/:id/activity
    // ----------------------------------------------------------------

    /**
     * Return recent activity log for a project.
     * Query params: ?limit=50
     * Requires at least VIEW access.
     *
     * @type {import('express').RequestHandler}
     */
    const getActivity = async (req, res, next) => {
        try {
            const projectId = req.params.id;
            const limit     = parseInt(req.query.limit ?? '50', 10);
            const activity  = await activityService.getActivity(projectId, limit);
            res.json({ activity });
        } catch (err) {
            next(err);
        }
    };

    return {
        getMembers,
        addMember,
        updateMemberRole,
        removeMember,
        getSharedProjects,
        getActivity,
    };
}
