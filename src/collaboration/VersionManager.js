// =====================================================================
// VersionManager – Phase J (Collaboration)
//
// Manages project version history stored in the `project_versions` table.
//
// Database table: project_versions
//   id             – UUID (PK)
//   project_id     – FK -> projects.id
//   version_number – integer, auto-incrementing per project
//   description    – text (human-readable label)
//   project_data   – JSONB (full project snapshot)
//   created_by     – FK -> auth.users
//   created_at     – timestamp
// =====================================================================

export class VersionManager {

    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     * @param {import('./PermissionManager.js').PermissionManager} permissionManager
     */
    constructor(supabaseClient, permissionManager) {
        if (!supabaseClient)    throw new Error('VersionManager: supabaseClient is required.');
        if (!permissionManager) throw new Error('VersionManager: permissionManager is required.');

        this._supabase    = supabaseClient;
        this._permissions = permissionManager;
    }


    // ------------------------------------------------------------------
    // Create / list / get
    // ------------------------------------------------------------------

    /**
     * Snapshot the current project state as a new version.
     *
     * @param {string} projectId
     * @param {object} projectData   – full project JSON (from ProjectManager.getProjectJSON())
     * @param {string} [description] – optional human-readable label
     * @returns {Promise<{id:string,versionNumber:number,description:string,createdAt:string}>}
     */
    async createVersion(projectId, projectData, description = '') {
        const { data: sessionData } = await this._supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id ?? null;

        // Retry up to 3 times to handle the (rare) concurrent-insert race
        // on the UNIQUE (project_id, version_number) constraint.
        const MAX_ATTEMPTS = 3;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            // Determine the next version number for this project
            const { data: latest, error: cntErr } = await this._supabase
                .from('project_versions')
                .select('version_number')
                .eq('project_id', projectId)
                .order('version_number', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (cntErr) throw new Error(`VersionManager.createVersion (count): ${cntErr.message}`);

            const nextNumber = (latest?.version_number ?? 0) + 1;

            const { data, error } = await this._supabase
                .from('project_versions')
                .insert({
                    project_id:     projectId,
                    version_number: nextNumber,
                    description:    description || `Version ${nextNumber}`,
                    project_data:   projectData,
                    created_by:     userId,
                })
                .select('id, version_number, description, created_at')
                .single();

            if (!error) {
                return {
                    id:            data.id,
                    versionNumber: data.version_number,
                    description:   data.description,
                    createdAt:     data.created_at,
                };
            }

            // PostgreSQL unique-constraint violation → another concurrent caller
            // grabbed this version number; re-read MAX and retry.
            if (error.code === '23505' && attempt < MAX_ATTEMPTS) {
                console.warn(
                    `VersionManager.createVersion: version number collision on attempt ${attempt}, retrying…`
                );
                continue;
            }

            throw new Error(`VersionManager.createVersion: ${error.message}`);
        }

        // Should not be reached, but keeps the linter happy.
        throw new Error('VersionManager.createVersion: exceeded max retry attempts.');
    }

    /**
     * List all versions of a project WITHOUT their project_data payloads.
     * The list is sorted from newest to oldest.
     *
     * @param {string} projectId
     * @returns {Promise<Array<{id:string,versionNumber:number,description:string,createdBy:string,createdAt:string,displayName:string}>>}
     */
    async getVersions(projectId) {
        const { data, error } = await this._supabase
            .from('project_versions')
            .select(`
                id,
                version_number,
                description,
                created_by,
                created_at,
                user_profiles ( display_name )
            `)
            .eq('project_id', projectId)
            .order('version_number', { ascending: false });

        if (error) throw new Error(`VersionManager.getVersions: ${error.message}`);

        return (data ?? []).map(row => ({
            id:            row.id,
            versionNumber: row.version_number,
            description:   row.description,
            createdBy:     row.created_by,
            displayName:   row.user_profiles?.display_name ?? row.created_by ?? 'Unknown',
            createdAt:     row.created_at,
        }));
    }

    /**
     * Fetch a single version including its full project_data payload.
     *
     * @param {string} projectId
     * @param {string} versionId
     * @returns {Promise<{id:string,versionNumber:number,description:string,createdBy:string,createdAt:string,projectData:object}>}
     */
    async getVersion(projectId, versionId) {
        const { data, error } = await this._supabase
            .from('project_versions')
            .select('id, version_number, description, created_by, created_at, project_data')
            .eq('project_id', projectId)
            .eq('id', versionId)
            .single();

        if (error) throw new Error(`VersionManager.getVersion: ${error.message}`);

        return {
            id:            data.id,
            versionNumber: data.version_number,
            description:   data.description,
            createdBy:     data.created_by,
            createdAt:     data.created_at,
            projectData:   data.project_data,
        };
    }


    // ------------------------------------------------------------------
    // Restore
    // ------------------------------------------------------------------

    /**
     * Restore a project to a previous version.
     *
     * Steps:
     *  1. Snapshot the current state as "Auto-save before restore".
     *  2. Load the target version's project_data.
     *  3. Overwrite the `projects` row with the old data and increment
     *     `project_version` (optimistic-locking counter).
     *
     * Requires owner permission.
     *
     * @param {string} projectId
     * @param {string} versionId          – the version to restore
     * @param {object} currentProjectData – current state to snapshot first
     * @returns {Promise<object>}          – the restored project_data
     */
    async restoreVersion(projectId, versionId, currentProjectData) {
        if (!this._permissions.canRestoreVersion) {
            throw new Error('VersionManager.restoreVersion: insufficient permissions (owner required).');
        }

        // Step 1 – auto-save current state before we overwrite anything
        await this.createVersion(projectId, currentProjectData, 'Auto-save before restore');

        // Step 2 – load the target version
        const target = await this.getVersion(projectId, versionId);

        // Step 3 – overwrite the project row
        //   We increment project_version to invalidate any stale cached versions
        //   held by other clients (triggers CONFLICT on their next save).
        const { error: updateErr } = await this._supabase
            .from('projects')
            .update({
                data:            target.projectData,
                updated_at:      new Date().toISOString(),
            })
            .eq('id', projectId);

        if (updateErr) throw new Error(`VersionManager.restoreVersion (update): ${updateErr.message}`);

        return target.projectData;
    }


    // ------------------------------------------------------------------
    // Delete
    // ------------------------------------------------------------------

    /**
     * Permanently delete a version record.
     * Only the project owner may delete versions.
     *
     * @param {string} projectId
     * @param {string} versionId
     * @returns {Promise<void>}
     */
    async deleteVersion(projectId, versionId) {
        if (!this._permissions.canManage) {
            throw new Error('VersionManager.deleteVersion: insufficient permissions (owner required).');
        }

        const { error } = await this._supabase
            .from('project_versions')
            .delete()
            .eq('id', versionId)
            .eq('project_id', projectId);

        if (error) throw new Error(`VersionManager.deleteVersion: ${error.message}`);
    }
}
