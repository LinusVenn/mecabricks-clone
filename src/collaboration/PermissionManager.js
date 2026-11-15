// =====================================================================
// PermissionManager – Phase J (Collaboration)
//
// Caches and manages the current user's role for a specific project.
// Fetches from Supabase on demand and notifies subscribers on change.
//
// Role resolution priority:
//   1. Owner  – user is listed as owner_id in the projects table
//   2. Editor – found in project_members with role='editor'
//   3. Viewer – found in project_members with role='viewer'
//   4. null   – user has no access
// =====================================================================

import { CollaborationRole } from './CollaborationState.js';

export class PermissionManager {

    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     */
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('PermissionManager: supabaseClient is required.');

        this._supabase   = supabaseClient;
        this._role       = null;   // current cached role
        this._listeners  = new Set();
    }


    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Load (and cache) the current user's role for a project.
     * Notifies subscribers if the role changed.
     *
     * @param {string} projectId
     * @param {string} userId
     * @returns {Promise<string|null>} Resolved role or null if no access.
     */
    async loadRole(projectId, userId) {
        const newRole = await this._fetchRole(projectId, userId);
        const changed = newRole !== this._role;
        this._role = newRole;
        if (changed) this._notify();
        return this._role;
    }

    /** Cached role (may be null if not yet loaded or user has no access). */
    get currentRole()           { return this._role; }

    /** True when the user may place/move/delete parts. */
    get canEdit()               { return this._role === CollaborationRole.OWNER || this._role === CollaborationRole.EDITOR; }

    /** True when the user may invite/remove members and change roles. */
    get canManage()             { return this._role === CollaborationRole.OWNER; }

    /** True when the user has any level of access. */
    get canView()               { return !!this._role; }

    /** True when the user may restore a previous version. */
    get canRestoreVersion()     { return this._role === CollaborationRole.OWNER; }

    /**
     * Clear the cached role (e.g., on project close or sign-out).
     */
    clearRole() {
        const changed = this._role !== null;
        this._role = null;
        if (changed) this._notify();
    }

    /**
     * Subscribe to role changes.
     * @param {function(string|null): void} callback
     * @returns {function(): void} Unsubscribe function.
     */
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }


    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /**
     * Fetches the user's role for the given project from Supabase.
     *
     * Strategy:
     *   1. Check `projects.owner_id` → 'owner'
     *   2. Check `project_members.role` → 'editor' | 'viewer'
     *   3. Otherwise → null
     *
     * @param {string} projectId
     * @param {string} userId
     * @returns {Promise<string|null>}
     */
    async _fetchRole(projectId, userId) {
        try {
            // Step 1 – owner check
            const { data: project, error: projErr } = await this._supabase
                .from('projects')
                .select('owner_id')
                .eq('id', projectId)
                .maybeSingle();

            if (projErr) {
                console.warn('PermissionManager._fetchRole: project query error', projErr.message);
                return null;
            }

            if (project && project.owner_id === userId) {
                return CollaborationRole.OWNER;
            }

            // Step 2 – membership check
            const { data: membership, error: memErr } = await this._supabase
                .from('project_members')
                .select('role')
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .maybeSingle();

            if (memErr) {
                console.warn('PermissionManager._fetchRole: membership query error', memErr.message);
                return null;
            }

            if (membership) {
                // Normalise: only accept known roles
                const r = membership.role;
                if (r === CollaborationRole.EDITOR || r === CollaborationRole.VIEWER) {
                    return r;
                }
            }

            return null;
        } catch (err) {
            console.error('PermissionManager._fetchRole: unexpected error', err);
            return null;
        }
    }

    /** Notify all subscribers with the current role. */
    _notify() {
        for (const cb of this._listeners) {
            try { cb(this._role); } catch (e) { console.error('PermissionManager subscriber error', e); }
        }
    }
}
