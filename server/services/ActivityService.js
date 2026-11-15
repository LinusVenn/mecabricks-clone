/**
 * ActivityService.js
 *
 * Logs and retrieves collaborative activity events for projects.
 * Uses a service-role Supabase client so it can write activity records
 * regardless of which user triggered the action.
 */

/** @enum {string} Well-known activity action types. */
export const ActivityAction = Object.freeze({
    PROJECT_CREATED:      'PROJECT_CREATED',
    PROJECT_SAVED:        'PROJECT_SAVED',
    PROJECT_RENAMED:      'PROJECT_RENAMED',
    MEMBER_INVITED:       'MEMBER_INVITED',
    MEMBER_JOINED:        'MEMBER_JOINED',
    MEMBER_REMOVED:       'MEMBER_REMOVED',
    ROLE_CHANGED:         'ROLE_CHANGED',
    VERSION_CREATED:      'VERSION_CREATED',
    VERSION_RESTORED:     'VERSION_RESTORED',
    INVITATION_DECLINED:  'INVITATION_DECLINED',
    INVITATION_REVOKED:   'INVITATION_REVOKED',
});

export class ActivityService {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     *   Should be the service-role client so RLS is bypassed for inserts.
     */
    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('ActivityService requires a Supabase client.');
        }
        this._db = supabaseClient;
    }

    // ----------------------------------------------------------------
    // Write
    // ----------------------------------------------------------------

    /**
     * Record an activity event.
     *
     * @param {string} projectId  UUID of the project.
     * @param {string} userId     UUID of the user performing the action.
     * @param {string} action     One of the {@link ActivityAction} constants (or any string).
     * @param {Record<string,unknown>} [details={}]  Arbitrary JSON payload.
     * @returns {Promise<{id: string}>}  The newly created activity record id.
     * @throws {Error} When the insert fails.
     */
    async log(projectId, userId, action, details = {}) {
        const { data, error } = await this._db
            .from('project_activity')
            .insert({
                project_id: projectId,
                user_id:    userId,
                action,
                details,
            })
            .select('id')
            .single();

        if (error) {
            throw new Error(`ActivityService.log failed: ${error.message}`);
        }

        return { id: data.id };
    }

    // ----------------------------------------------------------------
    // Read
    // ----------------------------------------------------------------

    /**
     * Retrieve recent activity for a project, newest first.
     *
     * @param {string} projectId
     * @param {number} [limit=50]  Maximum number of records to return (capped at 200).
     * @returns {Promise<Array<{
     *   id: string,
     *   projectId: string,
     *   userId: string,
     *   action: string,
     *   details: Record<string,unknown>,
     *   createdAt: string,
     *   user: { displayName: string } | null
     * }>>}
     * @throws {Error} When the query fails.
     */
    async getActivity(projectId, limit = 50) {
        const safeLimit = Math.min(Math.max(1, limit), 200);

        const { data, error } = await this._db
            .from('project_activity')
            .select(`
                id,
                project_id,
                user_id,
                action,
                details,
                created_at,
                user_profiles!project_activity_user_id_fkey (
                    display_name
                )
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(safeLimit);

        if (error) {
            throw new Error(`ActivityService.getActivity failed: ${error.message}`);
        }

        return (data ?? []).map((row) => ({
            id:        row.id,
            projectId: row.project_id,
            userId:    row.user_id,
            action:    row.action,
            details:   row.details ?? {},
            createdAt: row.created_at,
            user:      row.user_profiles
                ? { displayName: row.user_profiles.display_name ?? null }
                : null,
        }));
    }
}
