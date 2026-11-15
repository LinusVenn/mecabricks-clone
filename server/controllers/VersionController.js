/**
 * VersionController.js
 *
 * Express controller methods for project version snapshot endpoints.
 *
 * Dependency injection pattern: call `createVersionController` with the
 * required services and destructure the returned handler functions.
 *
 * Route parameters expected:
 *   req.params.id        – project UUID
 *   req.params.versionId – version snapshot UUID
 *   req.user.id          – authenticated user UUID (set by auth middleware)
 */

/**
 * @param {{
 *   versionService: import('../services/VersionService.js').VersionService
 * }} services
 */
export function createVersionController({ versionService }) {
    // ----------------------------------------------------------------
    // GET /api/projects/:id/versions
    // ----------------------------------------------------------------

    /**
     * List all version snapshots for a project (metadata only, no data payload).
     * Requires at least VIEW access.
     *
     * @type {import('express').RequestHandler}
     */
    const getVersions = async (req, res, next) => {
        try {
            const projectId = req.params.id;
            const versions  = await versionService.getVersions(projectId);
            res.json({ versions });
        } catch (err) {
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // POST /api/projects/:id/versions
    // ----------------------------------------------------------------

    /**
     * Create a new version snapshot of the current project state.
     * Body: { projectData: object, description?: string }
     * Requires EDIT (owner or editor) access.
     *
     * @type {import('express').RequestHandler}
     */
    const createVersion = async (req, res, next) => {
        try {
            const projectId  = req.params.id;
            const createdBy  = req.user.id;
            const { projectData, description } = req.body;

            if (!projectData || typeof projectData !== 'object') {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Body must include projectData (object).',
                });
            }

            const version = await versionService.createVersion(
                projectId,
                projectData,
                createdBy,
                description ?? ''
            );

            res.status(201).json({ version });
        } catch (err) {
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // GET /api/projects/:id/versions/:versionId
    // ----------------------------------------------------------------

    /**
     * Fetch a single version snapshot including its full project_data payload.
     * Requires at least VIEW access.
     *
     * @type {import('express').RequestHandler}
     */
    const getVersion = async (req, res, next) => {
        try {
            const projectId = req.params.id;
            const versionId = req.params.versionId;

            const version = await versionService.getVersion(projectId, versionId);
            res.json({ version });
        } catch (err) {
            if (err.message?.includes('not found')) {
                return res.status(404).json({ error: 'Not Found', message: err.message });
            }
            next(err);
        }
    };

    // ----------------------------------------------------------------
    // POST /api/projects/:id/versions/:versionId/restore
    // ----------------------------------------------------------------

    /**
     * Restore the project to a previous snapshot.
     * Auto-saves current state first, then applies the snapshot.
     * Requires MANAGE (owner) access.
     *
     * @type {import('express').RequestHandler}
     */
    const restoreVersion = async (req, res, next) => {
        try {
            const projectId  = req.params.id;
            const versionId  = req.params.versionId;
            const restoredBy = req.user.id;

            const result = await versionService.restoreVersion(
                projectId,
                versionId,
                restoredBy
            );

            res.json({ result });
        } catch (err) {
            if (err.message?.includes('not found')) {
                return res.status(404).json({ error: 'Not Found', message: err.message });
            }
            next(err);
        }
    };

    return {
        getVersions,
        createVersion,
        getVersion,
        restoreVersion,
    };
}
