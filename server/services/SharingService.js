/**
 * SharingService.js
 *
 * Manages project membership: listing, adding, updating roles, and
 * removing members.  All mutating operations require the caller to be
 * the project owner (enforced via PermissionService).
 */

import { ActivityAction } from './ActivityService.js';

export class SharingService {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     *   Service-role client (bypasses RLS for reliable reads/writes).
     * @param {import('./PermissionService.js').PermissionService} permissionService
     * @param {import('./ActivityService.js').ActivityService} activityService
     */
    constructor(supabaseClient, permissionService, activityService) {
        if (!supabaseClient)    throw new Error('SharingService: supabaseClient is required.');
        if (!permissionService) throw new Error('SharingService: permissionService is required.');
        if (!activityService)   throw new Error('SharingService: activityService is required.');

        this._db          = supabaseClient;
        this._permissions = permissionService;
        this._activity    = activityService;
    }

    // ----------------------------------------------------------------
    // Read
    // ----------------------------------------------------------------

    /**
     * List all members of a project including the owner.
     *
     * @param {string} projectId
     * @returns {Promise<Array<{
     *   userId: string,
     *   role: string,
     *   displayName: string|null,
     *   joinedAt: string
     * }>>}
     * @throws {Error} When the query fails.
     */
    async getMembers(projectId) {
        // Fetch members rows joined with profiles for display names.
        const { data: members, error: memErr } = await this._db
            .from('project_members')
            .select(`
                user_id,
                role,
                joined_at,
                user_profiles!project_members_user_id_fkey (
                    display_name
                )
            `)
            .eq('project_id', projectId)
            .order('joined_at', { ascending: true });

        if (memErr) {
            throw new Error(`SharingService.getMembers failed: ${memErr.message}`);
        }

        // Also include the owner (from projects table).
        const { data: project, error: projErr } = await this._db
            .from('projects')
            .select('owner_id, user_profiles!projects_owner_id_fkey(display_name)')
            .eq('id', projectId)
            .single();

        if (projErr) {
            throw new Error(`SharingService.getMembers: could not fetch project owner: ${projErr.message}`);
        }

        const ownerEntry = {
            userId:      project.owner_id,
            role:        'owner',
            displayName: project.user_profiles?.display_name ?? null,
            joinedAt:    null,
        };

        const memberEntries = (members ?? []).map((m) => ({
            userId:      m.user_id,
            role:        m.role,
            displayName: m.user_profiles?.display_name ?? null,
            joinedAt:    m.joined_at,
        }));

        // Deduplicate: owner row wins if somehow also in members table.
        const seen = new Set([project.owner_id]);
        const unique = memberEntries.filter((m) => {
            if (seen.has(m.userId)) return false;
            seen.add(m.userId);
            return true;
        });

        return [ownerEntry, ...unique];
    }

    /**
     * Return projects where the user is a member but NOT the owner
     * (i.e. shared-with-me projects).
     *
     * @param {string} userId
     * @returns {Promise<Array<{
     *   projectId: string,
     *   role: string,
     *   project: { name: string, ownerDisplayName: string|null, updatedAt: string }
     * }>>}
     */
    async getSharedProjects(userId) {
        const { data, error } = await this._db
            .from('project_members')
            .select(`
                role,
                joined_at,
                projects!project_members_project_id_fkey (
                    id,
                    name,
                    updated_at,
                    user_profiles!projects_owner_id_fkey (
                        display_name
                    )
                )
            `)
            .eq('user_id', userId);

        if (error) {
            throw new Error(`SharingService.getSharedProjects failed: ${error.message}`);
        }

        return (data ?? []).map((row) => ({
            projectId: row.projects.id,
            role:      row.role,
            joinedAt:  row.joined_at,
            project: {
                name:              row.projects.name,
                ownerDisplayName:  row.projects.user_profiles?.display_name ?? null,
                updatedAt:         row.projects.updated_at,
            },
        }));
    }

    // ----------------------------------------------------------------
    // Write
    // ----------------------------------------------------------------

    /**
     * Add a user as a member of a project.
     *
     * @param {string} projectId
     * @param {string} userId      UUID of the user to add.
     * @param {'viewer'|'editor'} role
     * @param {string} addedBy     UUID of the requesting user (must be owner).
     * @returns {Promise<{ userId: string, role: string, joinedAt: string }>}
     * @throws {PermissionError} If addedBy is not the project owner.
     * @throws {Error} On DB failure.
     */
    async addMember(projectId, userId, role, addedBy) {
        await this._permissions.assertCan('manage', addedBy, projectId);

        if (!['viewer', 'editor'].includes(role)) {
            throw new Error(`Invalid role '${role}'. Must be 'viewer' or 'editor'.`);
        }

        const { data, error } = await this._db
            .from('project_members')
            .insert({
                project_id: projectId,
                user_id:    userId,
                role,
                created_by: addedBy,
            })
            .select('user_id, role, joined_at')
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error(`User ${userId} is already a member of project ${projectId}.`);
            }
            throw new Error(`SharingService.addMember failed: ${error.message}`);
        }

        await this._activity.log(projectId, addedBy, ActivityAction.MEMBER_JOINED, {
            addedUserId: userId,
            role,
        });

        return {
            userId:   data.user_id,
            role:     data.role,
            joinedAt: data.joined_at,
        };
    }

    /**
     * Change the role of an existing project member.
     *
     * @param {string} projectId
     * @param {string} userId       UUID of the member whose role to change.
     * @param {'viewer'|'editor'} newRole
     * @param {string} updatedBy    UUID of the requesting user (must be owner).
     * @returns {Promise<{ userId: string, role: string }>}
     * @throws {PermissionError} If updatedBy is not the project owner.
     */
    async updateMemberRole(projectId, userId, newRole, updatedBy) {
        await this._permissions.assertCan('manage', updatedBy, projectId);

        if (!['viewer', 'editor'].includes(newRole)) {
            throw new Error(`Invalid role '${newRole}'. Must be 'viewer' or 'editor'.`);
        }

        const { data, error } = await this._db
            .from('project_members')
            .update({ role: newRole })
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .select('user_id, role')
            .single();

        if (error) {
            throw new Error(`SharingService.updateMemberRole failed: ${error.message}`);
        }
        if (!data) {
            throw new Error(`Member ${userId} not found in project ${projectId}.`);
        }

        await this._activity.log(projectId, updatedBy, ActivityAction.ROLE_CHANGED, {
            targetUserId: userId,
            newRole,
        });

        return { userId: data.user_id, role: data.role };
    }

    /**
     * Remove a member from a project.
     *
     * @param {string} projectId
     * @param {string} userId     UUID of the member to remove.
     * @param {string} removedBy  UUID of the requesting user (must be owner).
     * @returns {Promise<void>}
     * @throws {PermissionError} If removedBy is not the project owner.
     */
    async removeMember(projectId, userId, removedBy) {
        await this._permissions.assertCan('manage', removedBy, projectId);

        const { error } = await this._db
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) {
            throw new Error(`SharingService.removeMember failed: ${error.message}`);
        }

        await this._activity.log(projectId, removedBy, ActivityAction.MEMBER_REMOVED, {
            removedUserId: userId,
        });
    }
}
