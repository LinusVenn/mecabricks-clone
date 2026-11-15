/**
 * InvitationService.js
 *
 * Manages project invitations: creating, accepting, declining,
 * revoking, and listing.
 *
 * Security:
 *   - Invitation tokens are 32 random bytes (URL-safe base64).
 *   - Only the SHA-256 hash of the token is stored in the database.
 *   - The raw token is returned once on creation and must be
 *     transmitted to the invitee out-of-band (e.g. via email).
 */

import { randomBytes, createHash } from 'node:crypto';
import { ActivityAction } from './ActivityService.js';

/** Default invitation validity period: 7 days */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generates a cryptographically secure URL-safe invitation token.
 * @returns {{ token: string, hash: string }}
 */
function generateToken() {
    const raw   = randomBytes(32).toString('base64url');
    const hash  = createHash('sha256').update(raw).digest('hex');
    return { token: raw, hash };
}

export class InvitationService {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     *   Service-role client (bypasses RLS).
     * @param {import('./PermissionService.js').PermissionService} permissionService
     * @param {import('./ActivityService.js').ActivityService} activityService
     */
    constructor(supabaseClient, permissionService, activityService) {
        if (!supabaseClient)    throw new Error('InvitationService: supabaseClient is required.');
        if (!permissionService) throw new Error('InvitationService: permissionService is required.');
        if (!activityService)   throw new Error('InvitationService: activityService is required.');

        this._db          = supabaseClient;
        this._permissions = permissionService;
        this._activity    = activityService;
    }

    // ----------------------------------------------------------------
    // Create
    // ----------------------------------------------------------------

    /**
     * Create a new invitation for an email address.
     *
     * @param {string} projectId
     * @param {string} invitedEmail   Email address of the invitee.
     * @param {'viewer'|'editor'} role
     * @param {string} createdBy      UUID of the inviting user (must be owner).
     * @param {number} [ttlMs]        Token validity in ms (default 7 days).
     * @returns {Promise<{
     *   invitationId: string,
     *   token: string,
     *   expiresAt: string
     * }>}  token is the raw (unhashed) value for transmission.
     * @throws {PermissionError} If createdBy is not the project owner.
     */
    async createInvitation(projectId, invitedEmail, role, createdBy, ttlMs = INVITATION_TTL_MS) {
        await this._permissions.assertCan('manage', createdBy, projectId);

        if (!['viewer', 'editor'].includes(role)) {
            throw new Error(`Invalid role '${role}'. Must be 'viewer' or 'editor'.`);
        }

        const { token, hash } = generateToken();
        const expiresAt = new Date(Date.now() + ttlMs).toISOString();

        // Revoke any existing pending invitation for the same email + project.
        await this._db
            .from('project_invitations')
            .update({ status: 'revoked' })
            .eq('project_id', projectId)
            .eq('invited_email', invitedEmail.toLowerCase())
            .eq('status', 'pending');

        const { data, error } = await this._db
            .from('project_invitations')
            .insert({
                project_id:    projectId,
                invited_email: invitedEmail.toLowerCase(),
                role,
                token_hash:    hash,
                expires_at:    expiresAt,
                created_by:    createdBy,
            })
            .select('id, expires_at')
            .single();

        if (error) {
            throw new Error(`InvitationService.createInvitation failed: ${error.message}`);
        }

        await this._activity.log(projectId, createdBy, ActivityAction.MEMBER_INVITED, {
            invitedEmail,
            role,
        });

        return {
            invitationId: data.id,
            token,                   // raw token — must be sent via email
            expiresAt:    data.expires_at,
        };
    }

    // ----------------------------------------------------------------
    // Accept / Decline
    // ----------------------------------------------------------------

    /**
     * Accept an invitation using the raw (unhashed) token.
     *
     * Delegates to the `respond_to_invitation` SECURITY DEFINER function
     * in Supabase so that the invitation row can be updated and the
     * member row inserted atomically without service-role privileges on
     * the client side.
     *
     * @param {string} invitationToken  Raw token (URL-safe base64).
     * @param {string} userId           UUID of the accepting user.
     * @returns {Promise<{ projectId: string, role: string }>}
     * @throws {Error} If the token is invalid, expired, or already used.
     */
    async acceptInvitation(invitationToken, userId) {
        const hash = createHash('sha256').update(invitationToken).digest('hex');

        const { data, error } = await this._db.rpc('respond_to_invitation', {
            p_token_hash: hash,
            p_user_id:    userId,
            p_response:   'accepted',
        });

        if (error) {
            const msg = error.message ?? '';
            if (msg.includes('INVITATION_NOT_FOUND')) {
                throw new Error('INVITATION_NOT_FOUND: Invitation is invalid, expired, or already used.');
            }
            throw new Error(`InvitationService.acceptInvitation failed: ${msg}`);
        }

        await this._activity.log(data.projectId, userId, ActivityAction.MEMBER_JOINED, {
            role: data.role,
            via:  'invitation',
        });

        return { projectId: data.projectId, role: data.role };
    }

    /**
     * Decline an invitation using the raw token.
     *
     * @param {string} invitationToken
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async declineInvitation(invitationToken, userId) {
        const hash = createHash('sha256').update(invitationToken).digest('hex');

        const { data, error } = await this._db.rpc('respond_to_invitation', {
            p_token_hash: hash,
            p_user_id:    userId,
            p_response:   'declined',
        });

        if (error) {
            const msg = error.message ?? '';
            if (msg.includes('INVITATION_NOT_FOUND')) {
                throw new Error('INVITATION_NOT_FOUND: Invitation is invalid, expired, or already used.');
            }
            throw new Error(`InvitationService.declineInvitation failed: ${msg}`);
        }

        await this._activity.log(data.projectId, userId, ActivityAction.INVITATION_DECLINED, {
            via: 'invitation',
        });
    }

    // ----------------------------------------------------------------
    // Revoke
    // ----------------------------------------------------------------

    /**
     * Revoke an outstanding invitation (owner action).
     *
     * @param {string} invitationId  UUID of the invitation row.
     * @param {string} revokedBy     UUID of the revoking user (must be owner).
     * @returns {Promise<void>}
     * @throws {Error} If the invitation is not found or already resolved.
     */
    async revokeInvitation(invitationId, revokedBy) {
        // Fetch the invitation to verify ownership.
        const { data: inv, error: fetchErr } = await this._db
            .from('project_invitations')
            .select('project_id, status')
            .eq('id', invitationId)
            .single();

        if (fetchErr || !inv) {
            throw new Error(`InvitationService.revokeInvitation: invitation not found (${invitationId}).`);
        }

        await this._permissions.assertCan('manage', revokedBy, inv.project_id);

        if (inv.status !== 'pending') {
            throw new Error(
                `InvitationService.revokeInvitation: cannot revoke invitation with status '${inv.status}'.`
            );
        }

        const { error } = await this._db
            .from('project_invitations')
            .update({ status: 'revoked' })
            .eq('id', invitationId);

        if (error) {
            throw new Error(`InvitationService.revokeInvitation failed: ${error.message}`);
        }

        await this._activity.log(inv.project_id, revokedBy, ActivityAction.INVITATION_REVOKED, {
            invitationId,
        });
    }

    // ----------------------------------------------------------------
    // List
    // ----------------------------------------------------------------

    /**
     * Get all pending invitations for the currently authenticated user
     * (matched by their auth.users email stored when they registered).
     *
     * @param {string} userId
     * @returns {Promise<Array<{
     *   id: string,
     *   projectId: string,
     *   projectName: string,
     *   invitedEmail: string,
     *   role: string,
     *   expiresAt: string,
     *   createdAt: string
     * }>>}
     */
    async getUserInvitations(userId) {
        // Look up the user's email from auth.users via a service-role query.
        const { data: authUser, error: authErr } = await this._db.auth.admin.getUserById(userId);

        if (authErr || !authUser?.user?.email) {
            throw new Error(`InvitationService.getUserInvitations: could not resolve email for user ${userId}.`);
        }

        const email = authUser.user.email.toLowerCase();

        const { data, error } = await this._db
            .from('project_invitations')
            .select(`
                id,
                project_id,
                invited_email,
                role,
                expires_at,
                created_at,
                projects!project_invitations_project_id_fkey ( name )
            `)
            .eq('invited_email', email)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString());

        if (error) {
            throw new Error(`InvitationService.getUserInvitations failed: ${error.message}`);
        }

        return (data ?? []).map((row) => ({
            id:           row.id,
            projectId:    row.project_id,
            projectName:  row.projects?.name ?? null,
            invitedEmail: row.invited_email,
            role:         row.role,
            expiresAt:    row.expires_at,
            createdAt:    row.created_at,
        }));
    }

    /**
     * Get all invitations created for a project (any status).
     * Requires the caller to be the project owner.
     *
     * @param {string} projectId
     * @returns {Promise<Array<{
     *   id: string,
     *   invitedEmail: string,
     *   role: string,
     *   status: string,
     *   expiresAt: string,
     *   createdAt: string
     * }>>}
     */
    async getProjectInvitations(projectId) {
        const { data, error } = await this._db
            .from('project_invitations')
            .select('id, invited_email, role, status, expires_at, created_at')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`InvitationService.getProjectInvitations failed: ${error.message}`);
        }

        return (data ?? []).map((row) => ({
            id:           row.id,
            invitedEmail: row.invited_email,
            role:         row.role,
            status:       row.status,
            expiresAt:    row.expires_at,
            createdAt:    row.created_at,
        }));
    }
}
