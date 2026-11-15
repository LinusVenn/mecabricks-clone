/**
 * PresenceService.js
 *
 * In-memory presence tracker for WebSocket project rooms.
 *
 * Data model per user per project:
 *   {
 *     userId:   string,
 *     status:   'active'|'idle'|'away',
 *     lastSeen: string   (ISO 8601),
 *     meta:     object   (display name, cursor, selection, color, …)
 *   }
 *
 * This service is intentionally stateful and in-process only.
 * For multi-instance deployments it should be replaced with a Redis-backed
 * implementation that publishes changes via Pub/Sub.
 */

export class PresenceService {
    constructor() {
        /**
         * presence: Map<projectId, Map<userId, PresenceEntry>>
         * @type {Map<string, Map<string, object>>}
         */
        this._presence = new Map();
    }

    // ----------------------------------------------------------------
    // Lifecycle
    // ----------------------------------------------------------------

    /**
     * Record a user as online in a project room.
     *
     * @param {string} projectId
     * @param {string} userId
     * @param {object} [meta]  Initial metadata (displayName, color, …).
     */
    userJoined(projectId, userId, meta = {}) {
        this._ensureRoom(projectId).set(userId, {
            userId,
            status:   'active',
            lastSeen: new Date().toISOString(),
            meta:     { ...meta },
        });
    }

    /**
     * Remove a user from a project room's presence map.
     *
     * @param {string} projectId
     * @param {string} userId
     */
    userLeft(projectId, userId) {
        const room = this._presence.get(projectId);
        if (!room) return;

        room.delete(userId);

        if (room.size === 0) {
            this._presence.delete(projectId);
        }
    }

    // ----------------------------------------------------------------
    // Updates
    // ----------------------------------------------------------------

    /**
     * Merge a partial presence update for a user.
     *
     * Recognised top-level fields: `status`, `lastSeen`, `meta`.
     * Any extra fields are merged into `meta`.
     *
     * @param {string} projectId
     * @param {string} userId
     * @param {object} update  Partial presence data.
     */
    updatePresence(projectId, userId, update) {
        const room = this._presence.get(projectId);
        if (!room) return;

        const entry = room.get(userId);
        if (!entry) return;

        const { status, lastSeen, ...metaUpdate } = update;

        if (status !== undefined)   entry.status   = status;
        if (lastSeen !== undefined) entry.lastSeen  = lastSeen;

        entry.lastSeen = new Date().toISOString(); // always refresh on update
        entry.meta     = { ...entry.meta, ...metaUpdate };
    }

    /**
     * Mark a user as idle (e.g. from a heartbeat timeout).
     *
     * @param {string} projectId
     * @param {string} userId
     */
    markIdle(projectId, userId) {
        this.updatePresence(projectId, userId, { status: 'idle' });
    }

    // ----------------------------------------------------------------
    // Queries
    // ----------------------------------------------------------------

    /**
     * Return the presence list for a project.
     *
     * @param {string} projectId
     * @returns {Array<{userId: string, status: string, lastSeen: string, meta: object}>}
     */
    getPresence(projectId) {
        const room = this._presence.get(projectId);
        if (!room) return [];
        return [...room.values()].map((entry) => ({ ...entry, meta: { ...entry.meta } }));
    }

    /**
     * Check whether a specific user is currently online in a project.
     *
     * @param {string} projectId
     * @param {string} userId
     * @returns {boolean}
     */
    isOnline(projectId, userId) {
        return this._presence.get(projectId)?.has(userId) ?? false;
    }

    /**
     * Return the number of online users in a project room.
     *
     * @param {string} projectId
     * @returns {number}
     */
    getOnlineCount(projectId) {
        return this._presence.get(projectId)?.size ?? 0;
    }

    /**
     * Return all project IDs that currently have at least one online user.
     *
     * @returns {string[]}
     */
    getActiveProjects() {
        return [...this._presence.keys()];
    }

    // ----------------------------------------------------------------
    // Private helpers
    // ----------------------------------------------------------------

    /**
     * Return (or create) the presence map for a project.
     *
     * @param {string} projectId
     * @returns {Map<string, object>}
     */
    _ensureRoom(projectId) {
        if (!this._presence.has(projectId)) {
            this._presence.set(projectId, new Map());
        }
        return this._presence.get(projectId);
    }
}
