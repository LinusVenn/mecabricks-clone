/**
 * PermissionService.js
 *
 * Pure logic module for checking project-level permissions.
 * Not tied to Express – call it from middleware, controllers, or
 * WebSocket handlers.
 *
 * Role hierarchy:
 *   owner  → all permissions
 *   editor → view, edit, createVersion, restoreVersion
 *   viewer → view only
 *   null   → no access
 */

/** @typedef {'owner'|'editor'|'viewer'|null} ProjectRole */

/** Error thrown when a permission assertion fails (HTTP 403 equivalent). */
export class PermissionError extends Error {
    /**
     * @param {string} action
     * @param {string} userId
     * @param {string} projectId
     */
    constructor(action, userId, projectId) {
        super(
            `User ${userId} does not have permission to '${action}' on project ${projectId}.`
        );
        this.name = 'PermissionError';
        this.statusCode = 403;
        this.action = action;
        this.userId = userId;
        this.projectId = projectId;
    }
}

export class PermissionService {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdminClient
     *   Service-role client that bypasses RLS (for authoritative role lookups).
     */
    constructor(supabaseAdminClient) {
        if (!supabaseAdminClient) {
            throw new Error('PermissionService requires a Supabase admin client.');
        }
        this._db = supabaseAdminClient;
    }

    // ----------------------------------------------------------------
    // Core role resolution
    // ----------------------------------------------------------------

    /**
     * Return the effective role of a user for a project.
     *
     * Checks owner_id first (fast path), then project_members.
     *
     * @param {string} userId
     * @param {string} projectId
     * @returns {Promise<ProjectRole>} Role string or null if no access.
     */
    async getRole(userId, projectId) {
        if (!userId || !projectId) return null;

        // Fast path: is the user the project owner?
        const { data: project, error: projErr } = await this._db
            .from('projects')
            .select('owner_id')
            .eq('id', projectId)
            .single();

        if (projErr || !project) return null;

        if (project.owner_id === userId) return 'owner';

        // Slow path: check project_members
        const { data: member, error: memErr } = await this._db
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();

        if (memErr || !member) return null;

        return /** @type {ProjectRole} */ (member.role);
    }

    // ----------------------------------------------------------------
    // Permission predicates
    // ----------------------------------------------------------------

    /**
     * Returns true if the user can view (read) the project.
     * @param {string} userId
     * @param {string} projectId
     * @returns {Promise<boolean>}
     */
    async canView(userId, projectId) {
        const role = await this.getRole(userId, projectId);
        return role !== null; // any role grants view
    }

    /**
     * Returns true if the user can edit project content.
     * @param {string} userId
     * @param {string} projectId
     * @returns {Promise<boolean>}
     */
    async canEdit(userId, projectId) {
        const role = await this.getRole(userId, projectId);
        return role === 'owner' || role === 'editor';
    }

    /**
     * Returns true if the user can manage members (add / remove / change roles).
     * @param {string} userId
     * @param {string} projectId
     * @returns {Promise<boolean>}
     */
    async canManageMembers(userId, projectId) {
        const role = await this.getRole(userId, projectId);
        return role === 'owner';
    }

    /**
     * Returns true if the user can delete the project.
     * @param {string} userId
     * @param {string} projectId
     * @returns {Promise<boolean>}
     */
    async canDelete(userId, projectId) {
        const role = await this.getRole(userId, projectId);
        return role === 'owner';
    }

    /**
     * Returns true if the user can restore a previous version.
     * @param {string} userId
     * @param {string} projectId
     * @returns {Promise<boolean>}
     */
    async canRestoreVersion(userId, projectId) {
        const role = await this.getRole(userId, projectId);
        return role === 'owner' || role === 'editor';
    }

    // ----------------------------------------------------------------
    // Assertion helper
    // ----------------------------------------------------------------

    /**
     * Throws a {@link PermissionError} if the user lacks the required permission.
     *
     * @param {'view'|'edit'|'manage'|'delete'|'restoreVersion'} action
     * @param {string} userId
     * @param {string} projectId
     * @returns {Promise<void>}
     * @throws {PermissionError}
     */
    async assertCan(action, userId, projectId) {
        let allowed = false;

        switch (action) {
            case 'view':
                allowed = await this.canView(userId, projectId);
                break;
            case 'edit':
                allowed = await this.canEdit(userId, projectId);
                break;
            case 'manage':
                allowed = await this.canManageMembers(userId, projectId);
                break;
            case 'delete':
                allowed = await this.canDelete(userId, projectId);
                break;
            case 'restoreVersion':
                allowed = await this.canRestoreVersion(userId, projectId);
                break;
            default:
                throw new Error(`Unknown permission action: '${action}'`);
        }

        if (!allowed) {
            throw new PermissionError(action, userId, projectId);
        }
    }
}
