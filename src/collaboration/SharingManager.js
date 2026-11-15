// =====================================================================
// SharingManager – Phase J (Collaboration)
//
// Manages all project-sharing operations that touch Supabase directly:
//   • Listing / adding / removing project members
//   • Creating and managing invitations
//   • Fetching projects shared with the current user
//   • Accepting / declining invitation tokens
//
// Database tables used:
//   • projects          – owner_id check
//   • project_members   – role entries
//   • project_invitations – pending invitations
//   • user_profiles     – display names / emails
// =====================================================================

import { CollaborationRole } from './CollaborationState.js';

export class SharingManager {

    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     * @param {import('./PermissionManager.js').PermissionManager} permissionManager
     */
    constructor(supabaseClient, permissionManager) {
        if (!supabaseClient)    throw new Error('SharingManager: supabaseClient is required.');
        if (!permissionManager) throw new Error('SharingManager: permissionManager is required.');

        this._supabase    = supabaseClient;
        this._permissions = permissionManager;
    }


    // ------------------------------------------------------------------
    // Members
    // ------------------------------------------------------------------

    /**
     * Retrieve all members of a project (excludes the owner, who is listed
     * in the projects table rather than project_members).
     *
     * @param {string} projectId
     * @returns {Promise<Array<{userId:string,role:string,displayName:string,joinedAt:string,email:string}>>}
     */
    async getMembers(projectId) {
        const { data, error } = await this._supabase
            .from('project_members')
            .select(`
                user_id,
                role,
                joined_at,
                user_profiles ( display_name, email )
            `)
            .eq('project_id', projectId)
            .order('joined_at', { ascending: true });

        if (error) throw new Error(`SharingManager.getMembers: ${error.message}`);

        return (data ?? []).map(row => ({
            userId:      row.user_id,
            role:        row.role,
            displayName: row.user_profiles?.display_name ?? row.user_id,
            email:       row.user_profiles?.email        ?? '',
            joinedAt:    row.joined_at,
        }));
    }

    /**
     * Remove a member from a project.
     * Requires canManage permission.
     *
     * @param {string} projectId
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async removeMember(projectId, userId) {
        if (!this._permissions.canManage) {
            throw new Error('SharingManager.removeMember: insufficient permissions (owner required).');
        }

        const { error } = await this._supabase
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) throw new Error(`SharingManager.removeMember: ${error.message}`);
    }

    /**
     * Update the role of an existing member.
     * Requires canManage permission.
     *
     * @param {string} projectId
     * @param {string} userId
     * @param {'editor'|'viewer'} newRole
     * @returns {Promise<void>}
     */
    async updateMemberRole(projectId, userId, newRole) {
        if (!this._permissions.canManage) {
            throw new Error('SharingManager.updateMemberRole: insufficient permissions (owner required).');
        }
        if (newRole !== CollaborationRole.EDITOR && newRole !== CollaborationRole.VIEWER) {
            throw new Error(`SharingManager.updateMemberRole: invalid role '${newRole}'.`);
        }

        const { error } = await this._supabase
            .from('project_members')
            .update({ role: newRole })
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) throw new Error(`SharingManager.updateMemberRole: ${error.message}`);
    }


    // ------------------------------------------------------------------
    // Invitations (sent by the project owner)
    // ------------------------------------------------------------------

    /**
     * Create an invitation for a user by e-mail.
     * Inserts a row into `project_invitations`.
     * A unique token is generated server-side (or via crypto.randomUUID) and
     * the invitation expires after 7 days by default.
     *
     * @param {string} projectId
     * @param {string} email
     * @param {'editor'|'viewer'} role
     * @returns {Promise<{id:string,token:string,invitedEmail:string,role:string,expiresAt:string}>}
     */
    async inviteUser(projectId, email, role = CollaborationRole.VIEWER) {
        if (!this._permissions.canManage) {
            throw new Error('SharingManager.inviteUser: insufficient permissions (owner required).');
        }
        if (role !== CollaborationRole.EDITOR && role !== CollaborationRole.VIEWER) {
            throw new Error(`SharingManager.inviteUser: invalid role '${role}'.`);
        }

        const token     = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: session } = await this._supabase.auth.getSession();
        const createdBy = session?.session?.user?.id ?? null;

        const { data, error } = await this._supabase
            .from('project_invitations')
            .insert({
                project_id:    projectId,
                invited_email: email,
                role,
                status:        'pending',
                token_hash:    token,
                expires_at:    expiresAt,
                created_by:    createdBy,
            })
            .select('id, token_hash, invited_email, role, expires_at')
            .single();

        if (error) throw new Error(`SharingManager.inviteUser: ${error.message}`);

        return {
            id:           data.id,
            token:        data.token_hash,
            invitedEmail: data.invited_email,
            role:         data.role,
            expiresAt:    data.expires_at,
        };
    }

    /**
     * List all invitations for a project.
     *
     * @param {string} projectId
     * @returns {Promise<Array<{id:string,invitedEmail:string,role:string,status:string,expiresAt:string,createdAt:string}>>}
     */
    async getInvitations(projectId) {
        const { data, error } = await this._supabase
            .from('project_invitations')
            .select('id, invited_email, role, status, expires_at, created_at')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`SharingManager.getInvitations: ${error.message}`);

        return (data ?? []).map(row => ({
            id:           row.id,
            invitedEmail: row.invited_email,
            role:         row.role,
            status:       row.status,
            expiresAt:    row.expires_at,
            createdAt:    row.created_at,
        }));
    }

    /**
     * Revoke (hard-delete) a pending invitation.
     *
     * @param {string} projectId
     * @param {string} invitationId
     * @returns {Promise<void>}
     */
    async revokeInvitation(projectId, invitationId) {
        if (!this._permissions.canManage) {
            throw new Error('SharingManager.revokeInvitation: insufficient permissions (owner required).');
        }

        const { error } = await this._supabase
            .from('project_invitations')
            .delete()
            .eq('id', invitationId)
            .eq('project_id', projectId);

        if (error) throw new Error(`SharingManager.revokeInvitation: ${error.message}`);
    }


    // ------------------------------------------------------------------
    // Invitations (received by the invited user)
    // ------------------------------------------------------------------

    /**
     * Returns all pending invitations addressed to the current user's e-mail.
     *
     * @returns {Promise<Array<{id:string,projectId:string,projectName:string,role:string,invitedEmail:string,expiresAt:string,createdAt:string,token:string}>>}
     */
    async getUserInvitations() {
        const { data: sessionData } = await this._supabase.auth.getSession();
        const email = sessionData?.session?.user?.email;
        if (!email) return [];

        const { data, error } = await this._supabase
            .from('project_invitations')
            .select(`
                id,
                project_id,
                role,
                invited_email,
                expires_at,
                created_at,
                token_hash,
                projects ( name )
            `)
            .eq('invited_email', email)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString());

        if (error) throw new Error(`SharingManager.getUserInvitations: ${error.message}`);

        return (data ?? []).map(row => ({
            id:           row.id,
            projectId:    row.project_id,
            projectName:  row.projects?.name ?? row.project_id,
            role:         row.role,
            invitedEmail: row.invited_email,
            expiresAt:    row.expires_at,
            createdAt:    row.created_at,
            token:        row.token_hash,
        }));
    }

    /**
     * Accept an invitation by its token.
     * Inserts the current user into `project_members` and marks the invitation
     * as 'accepted'.
     *
     * @param {string} token
     * @returns {Promise<{projectId:string,role:string}>}
     */
    async acceptInvitation(token) {
        const { data: sessionData } = await this._supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) throw new Error('SharingManager.acceptInvitation: user must be signed in.');

        // Fetch the invitation
        const { data: invitation, error: fetchErr } = await this._supabase
            .from('project_invitations')
            .select('id, project_id, role, status, expires_at, invited_email')
            .eq('token_hash', token)
            .maybeSingle();

        if (fetchErr)  throw new Error(`SharingManager.acceptInvitation: ${fetchErr.message}`);
        if (!invitation) throw new Error('SharingManager.acceptInvitation: invitation not found.');
        if (invitation.status !== 'pending') throw new Error(`SharingManager.acceptInvitation: invitation is already ${invitation.status}.`);
        if (new Date(invitation.expires_at) < new Date()) throw new Error('SharingManager.acceptInvitation: invitation has expired.');

        // Add to project_members (upsert in case they were previously removed)
        const { error: memberErr } = await this._supabase
            .from('project_members')
            .upsert({
                project_id: invitation.project_id,
                user_id:    userId,
                role:       invitation.role,
                joined_at:  new Date().toISOString(),
            }, { onConflict: 'project_id,user_id' });

        if (memberErr) throw new Error(`SharingManager.acceptInvitation (member insert): ${memberErr.message}`);

        // Mark invitation as accepted
        const { error: updateErr } = await this._supabase
            .from('project_invitations')
            .update({ status: 'accepted' })
            .eq('id', invitation.id);

        if (updateErr) console.warn('SharingManager.acceptInvitation: could not mark invitation accepted:', updateErr.message);

        return { projectId: invitation.project_id, role: invitation.role };
    }

    /**
     * Decline an invitation by its token.
     *
     * @param {string} token
     * @returns {Promise<void>}
     */
    async declineInvitation(token) {
        const { error } = await this._supabase
            .from('project_invitations')
            .update({ status: 'declined' })
            .eq('token_hash', token);

        if (error) throw new Error(`SharingManager.declineInvitation: ${error.message}`);
    }


    // ------------------------------------------------------------------
    // Shared projects (received by a member)
    // ------------------------------------------------------------------

    /**
     * Returns all projects shared with the current user (where the user is a
     * member but NOT the owner).
     *
     * @returns {Promise<Array<{projectId:string,projectName:string,role:string,joinedAt:string,ownerId:string}>>}
     */
    async getSharedProjects() {
        const { data: sessionData } = await this._supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return [];

        const { data, error } = await this._supabase
            .from('project_members')
            .select(`
                project_id,
                role,
                joined_at,
                projects ( id, name, owner_id )
            `)
            .eq('user_id', userId);

        if (error) throw new Error(`SharingManager.getSharedProjects: ${error.message}`);

        return (data ?? [])
            .filter(row => row.projects && row.projects.owner_id !== userId)
            .map(row => ({
                projectId:   row.project_id,
                projectName: row.projects.name,
                role:        row.role,
                joinedAt:    row.joined_at,
                ownerId:     row.projects.owner_id,
            }));
    }
}
