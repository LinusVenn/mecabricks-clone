/**
 * VersionService.js
 *
 * Manages project version snapshots.
 *
 * Workflow:
 *   - createVersion: Save current project state as a named snapshot.
 *   - getVersions:   List all snapshots (metadata only, no payload).
 *   - getVersion:    Fetch a single snapshot including its project_data.
 *   - restoreVersion: Auto-save current state, then overwrite project with
 *                     the snapshot data and increment project_version.
 */

import { ActivityAction } from './ActivityService.js';

export class VersionService {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     *   Service-role client.
     * @param {import('./PermissionService.js').PermissionService} permissionService
     * @param {import('./ActivityService.js').ActivityService} activityService
     */
    constructor(supabaseClient, permissionService, activityService) {
        if (!supabaseClient)    throw new Error('VersionService: supabaseClient is required.');
        if (!permissionService) throw new Error('VersionService: permissionService is required.');
        if (!activityService)   throw new Error('VersionService: activityService is required.');

        this._db          = supabaseClient;
        this._permissions = permissionService;
        this._activity    = activityService;
    }

    // ----------------------------------------------------------------
    // Create
    // ----------------------------------------------------------------

    /**
     * Create a version snapshot of the current project data.
     *
     * @param {string} projectId
     * @param {object} projectData   The JSONB project data to snapshot.
     * @param {string} createdBy     UUID of the requesting user (owner or editor).
     * @param {string} [description] Human-readable label for this snapshot.
     * @returns {Promise<{
     *   id: string,
     *   projectId: string,
     *   versionNumber: number,
     *   description: string,
     *   createdAt: string
     * }>}
     * @throws {PermissionError} If createdBy cannot edit the project.
     */
    async createVersion(projectId, projectData, createdBy, description = '') {
        await this._permissions.assertCan('edit', createdBy, projectId);

        // Calculate next version number using the DB function.
        const { data: nextNum, error: seqErr } = await this._db.rpc('next_version_number', {
            p_project_id: projectId,
        });

        if (seqErr) {
            throw new Error(`VersionService.createVersion: could not get next version number: ${seqErr.message}`);
        }

        const { data, error } = await this._db
            .from('project_versions')
            .insert({
                project_id:     projectId,
                version_number: nextNum,
                project_data:   projectData,
                created_by:     createdBy,
                description:    description ?? '',
            })
            .select('id, project_id, version_number, description, created_at')
            .single();

        if (error) {
            throw new Error(`VersionService.createVersion failed: ${error.message}`);
        }

        await this._activity.log(projectId, createdBy, ActivityAction.VERSION_CREATED, {
            versionId:     data.id,
            versionNumber: data.version_number,
            description:   data.description,
        });

        return {
            id:            data.id,
            projectId:     data.project_id,
            versionNumber: data.version_number,
            description:   data.description,
            createdAt:     data.created_at,
        };
    }

    // ----------------------------------------------------------------
    // Read
    // ----------------------------------------------------------------

    /**
     * List all version snapshots for a project (metadata only; no payload).
     *
     * @param {string} projectId
     * @returns {Promise<Array<{
     *   id: string,
     *   versionNumber: number,
     *   description: string,
     *   createdBy: string,
     *   createdByDisplayName: string|null,
     *   createdAt: string
     * }>>}
     */
    async getVersions(projectId) {
        const { data, error } = await this._db
            .from('project_versions')
            .select(`
                id,
                version_number,
                description,
                created_by,
                created_at,
                user_profiles!project_versions_created_by_fkey ( display_name )
            `)
            .eq('project_id', projectId)
            .order('version_number', { ascending: false });

        if (error) {
            throw new Error(`VersionService.getVersions failed: ${error.message}`);
        }

        return (data ?? []).map((row) => ({
            id:                   row.id,
            versionNumber:        row.version_number,
            description:          row.description,
            createdBy:            row.created_by,
            createdByDisplayName: row.user_profiles?.display_name ?? null,
            createdAt:            row.created_at,
        }));
    }

    /**
     * Fetch a single version snapshot including its full project_data payload.
     *
     * @param {string} projectId  Used to validate the version belongs to this project.
     * @param {string} versionId  UUID of the version row.
     * @returns {Promise<{
     *   id: string,
     *   projectId: string,
     *   versionNumber: number,
     *   description: string,
     *   projectData: object,
     *   createdBy: string,
     *   createdAt: string
     * }>}
     * @throws {Error} If the version does not exist or belongs to a different project.
     */
    async getVersion(projectId, versionId) {
        const { data, error } = await this._db
            .from('project_versions')
            .select('id, project_id, version_number, description, project_data, created_by, created_at')
            .eq('id', versionId)
            .eq('project_id', projectId)
            .single();

        if (error || !data) {
            throw new Error(`VersionService.getVersion: version ${versionId} not found.`);
        }

        return {
            id:            data.id,
            projectId:     data.project_id,
            versionNumber: data.version_number,
            description:   data.description,
            projectData:   data.project_data,
            createdBy:     data.created_by,
            createdAt:     data.created_at,
        };
    }

    // ----------------------------------------------------------------
    // Restore
    // ----------------------------------------------------------------

    /**
     * Restore a project to a previous version snapshot.
     *
     * Steps:
     *   1. Fetch the target version snapshot.
     *   2. Save the current project data as a new auto-save snapshot.
     *   3. Overwrite the project's `data` field with the snapshot data.
     *   4. Increment `project_version` (optimistic lock counter).
     *
     * @param {string} projectId
     * @param {string} versionId    UUID of the snapshot to restore.
     * @param {string} restoredBy   UUID of the requesting user (must be owner or editor).
     * @returns {Promise<{
     *   projectId: string,
     *   newProjectVersion: number,
     *   restoredFromVersion: number
     * }>}
     * @throws {PermissionError} If restoredBy cannot restoreVersion.
     * @throws {Error} On DB failure.
     */
    async restoreVersion(projectId, versionId, restoredBy) {
        await this._permissions.assertCan('restoreVersion', restoredBy, projectId);

        // 1. Fetch the target snapshot.
        const snapshot = await this.getVersion(projectId, versionId);

        // 2. Fetch current project state.
        const { data: currentProject, error: fetchErr } = await this._db
            .from('projects')
            .select('data, project_version')
            .eq('id', projectId)
            .single();

        if (fetchErr || !currentProject) {
            throw new Error(`VersionService.restoreVersion: project ${projectId} not found.`);
        }

        // 3. Auto-save current state before overwriting.
        await this.createVersion(
            projectId,
            currentProject.data,
            restoredBy,
            `Auto-save before restore to version ${snapshot.versionNumber}`
        );

        // 4. Overwrite project data and bump project_version.
        const { data: updated, error: updateErr } = await this._db
            .from('projects')
            .update({
                data:            snapshot.projectData,
                project_version: currentProject.project_version + 1,
            })
            .eq('id', projectId)
            .select('project_version')
            .single();

        if (updateErr) {
            throw new Error(`VersionService.restoreVersion: failed to update project: ${updateErr.message}`);
        }

        await this._activity.log(projectId, restoredBy, ActivityAction.VERSION_RESTORED, {
            versionId,
            restoredFromVersionNumber: snapshot.versionNumber,
            newProjectVersion:         updated.project_version,
        });

        return {
            projectId,
            newProjectVersion:   updated.project_version,
            restoredFromVersion: snapshot.versionNumber,
        };
    }
}
