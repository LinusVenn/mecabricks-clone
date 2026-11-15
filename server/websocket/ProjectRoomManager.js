/**
 * ProjectRoomManager.js
 *
 * Manages in-memory WebSocket "rooms" – one room per project.
 *
 * A room is a Map<userId, WebSocket> for each projectId.
 * The manager owns presence tracking via PresenceService and notifies
 * all room members when users join or leave.
 */

export class ProjectRoomManager {
    /**
     * @param {{
     *   permissionService: import('../services/PermissionService.js').PermissionService,
     *   messageRouter:     import('./MessageRouter.js').MessageRouter,
     *   presenceService:   import('./PresenceService.js').PresenceService
     * }} deps
     */
    constructor({ permissionService, messageRouter, presenceService }) {
        if (!permissionService) throw new Error('ProjectRoomManager: permissionService is required.');
        if (!presenceService)   throw new Error('ProjectRoomManager: presenceService is required.');

        this._permissions = permissionService;
        this._presence    = presenceService;

        /**
         * rooms: Map<projectId, Map<userId, WebSocket>>
         * @type {Map<string, Map<string, import('ws').WebSocket>>}
         */
        this._rooms = new Map();

        /**
         * Reverse index: userId → Set<projectId> for efficient leaveAllRooms.
         * @type {Map<string, Set<string>>}
         */
        this._userRooms = new Map();
    }

    // ----------------------------------------------------------------
    // Room membership
    // ----------------------------------------------------------------

    /**
     * Add a WebSocket connection to a project room, verifying that the
     * user has at least VIEW access.
     *
     * Broadcasts a PRESENCE_JOINED event to the rest of the room.
     *
     * @param {string} projectId
     * @param {string} userId
     * @param {import('ws').WebSocket} ws
     * @param {object} [meta]  Optional presence metadata (cursor, displayName, …).
     * @returns {Promise<void>}
     * @throws {Error} If the user does not have access.
     */
    async joinRoom(projectId, userId, ws, meta = {}) {
        const canView = await this._permissions.canView(userId, projectId);
        if (!canView) {
            throw Object.assign(
                new Error(`User ${userId} does not have access to project ${projectId}.`),
                { statusCode: 403 }
            );
        }

        // Ensure the room exists.
        if (!this._rooms.has(projectId)) {
            this._rooms.set(projectId, new Map());
        }

        const room = this._rooms.get(projectId);

        // Evict any stale socket for the same user (e.g. reconnect).
        const existingWs = room.get(userId);
        if (existingWs && existingWs !== ws) {
            try {
                existingWs.close(1000, 'Replaced by new connection.');
            } catch { /* ignore */ }
        }

        room.set(userId, ws);

        // Track reverse index.
        if (!this._userRooms.has(userId)) {
            this._userRooms.set(userId, new Set());
        }
        this._userRooms.get(userId).add(projectId);

        // Update presence.
        this._presence.userJoined(projectId, userId, meta);

        // Broadcast join to other room members.
        this.broadcast(projectId, {
            type:      'PRESENCE_JOINED',
            projectId,
            userId,
            presence:  this._presence.getPresence(projectId),
            timestamp: new Date().toISOString(),
        }, userId);

        // Send current room presence snapshot to the new joiner.
        this._send(ws, {
            type:      'ROOM_STATE',
            projectId,
            presence:  this._presence.getPresence(projectId),
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Remove a user from a specific project room.
     *
     * Broadcasts a PRESENCE_LEFT event to remaining room members.
     *
     * @param {string} projectId
     * @param {string} userId
     */
    leaveRoom(projectId, userId) {
        const room = this._rooms.get(projectId);
        if (!room) return;

        room.delete(userId);

        if (room.size === 0) {
            this._rooms.delete(projectId);
        }

        // Clean up reverse index.
        this._userRooms.get(userId)?.delete(projectId);

        this._presence.userLeft(projectId, userId);

        this.broadcast(projectId, {
            type:      'PRESENCE_LEFT',
            projectId,
            userId,
            presence:  this._presence.getPresence(projectId),
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Remove a user from ALL project rooms (used on WebSocket close).
     *
     * @param {string} userId
     */
    leaveAllRooms(userId) {
        const projectIds = this._userRooms.get(userId);
        if (!projectIds) return;

        // Snapshot before iterating to avoid mutation-during-iteration.
        for (const projectId of [...projectIds]) {
            this.leaveRoom(projectId, userId);
        }

        this._userRooms.delete(userId);
    }

    // ----------------------------------------------------------------
    // Broadcasting
    // ----------------------------------------------------------------

    /**
     * Send a message to every connected client in a project room.
     *
     * @param {string} projectId
     * @param {object} message          The payload object to JSON-encode.
     * @param {string|null} [excludeUserId]  Skip this user (e.g. the sender).
     */
    broadcast(projectId, message, excludeUserId = null) {
        const room = this._rooms.get(projectId);
        if (!room) return;

        const encoded = JSON.stringify(message);

        for (const [uid, ws] of room) {
            if (uid === excludeUserId) continue;
            if (ws.readyState === ws.constructor.OPEN) {
                ws.send(encoded);
            }
        }
    }

    // ----------------------------------------------------------------
    // Introspection
    // ----------------------------------------------------------------

    /**
     * Count connected clients in a room.
     *
     * @param {string} projectId
     * @returns {number}
     */
    getRoomSize(projectId) {
        return this._rooms.get(projectId)?.size ?? 0;
    }

    /**
     * Return a list of user IDs currently connected to a room.
     *
     * @param {string} projectId
     * @returns {string[]}
     */
    getConnectedUsers(projectId) {
        const room = this._rooms.get(projectId);
        return room ? [...room.keys()] : [];
    }

    /**
     * Close all connections and clear internal state.
     * Call this on server shutdown.
     */
    dispose() {
        for (const [, room] of this._rooms) {
            for (const [, ws] of room) {
                try { ws.close(1001, 'Server shutting down.'); } catch { /* ignore */ }
            }
        }
        this._rooms.clear();
        this._userRooms.clear();
    }

    // ----------------------------------------------------------------
    // Private helpers
    // ----------------------------------------------------------------

    /**
     * @param {import('ws').WebSocket} ws
     * @param {object} payload
     */
    _send(ws, payload) {
        if (ws.readyState === ws.constructor.OPEN) {
            ws.send(JSON.stringify(payload));
        }
    }
}
