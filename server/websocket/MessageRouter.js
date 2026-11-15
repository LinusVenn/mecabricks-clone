/**
 * MessageRouter.js
 *
 * Routes validated incoming WebSocket messages to the appropriate handler.
 *
 * Supported message types:
 *   JOIN_PROJECT    – client wants to join a project room
 *   LEAVE_PROJECT   – client explicitly leaves a project room
 *   PROJECT_EVENT   – a collaborative CRDT/operation event to broadcast
 *   PRESENCE_UPDATE – cursor / selection / status update
 *
 * All unknown types receive an ERROR response but do NOT close the socket.
 */

import { MessageValidator }  from './MessageValidator.js';
import { ActivityAction }    from '../services/ActivityService.js';

/** Message type constants to avoid magic strings. */
export const MessageType = {
    JOIN_PROJECT:    'JOIN_PROJECT',
    LEAVE_PROJECT:   'LEAVE_PROJECT',
    PROJECT_EVENT:   'PROJECT_EVENT',
    PRESENCE_UPDATE: 'PRESENCE_UPDATE',
    // Server-to-client only (never routed in):
    CONNECTED:       'CONNECTED',
    ROOM_STATE:      'ROOM_STATE',
    PRESENCE_JOINED: 'PRESENCE_JOINED',
    PRESENCE_LEFT:   'PRESENCE_LEFT',
    ERROR:           'ERROR',
    ACK:             'ACK',
};

export class MessageRouter {
    /**
     * @param {{
     *   projectRoomManager: import('./ProjectRoomManager.js').ProjectRoomManager,
     *   presenceService:    import('./PresenceService.js').PresenceService,
     *   permissionService:  import('../services/PermissionService.js').PermissionService,
     *   activityService:    import('../services/ActivityService.js').ActivityService
     * }} deps
     */
    constructor({
        projectRoomManager,
        presenceService,
        permissionService,
        activityService,
    }) {
        if (!projectRoomManager) throw new Error('MessageRouter: projectRoomManager is required.');
        if (!presenceService)    throw new Error('MessageRouter: presenceService is required.');

        this._rooms      = projectRoomManager;
        this._presence   = presenceService;
        this._permissions = permissionService;
        this._activity   = activityService;
        this._validator  = new MessageValidator();
    }

    // ----------------------------------------------------------------
    // Public entry point
    // ----------------------------------------------------------------

    /**
     * Route an incoming message from `userId` to the correct handler.
     *
     * @param {import('ws').WebSocket} ws
     * @param {string} userId
     * @param {string|null} projectId
     * @param {object} message  Parsed JSON payload
     * @returns {Promise<void>}
     */
    async route(ws, userId, projectId, message) {
        const { valid, errors } = this._validator.validate(message);

        if (!valid) {
            this._sendError(ws, projectId, message?.messageId, 'VALIDATION_ERROR', errors.join('; '));
            return;
        }

        const { type } = message;

        switch (type) {
            case MessageType.JOIN_PROJECT:
                await this._handleJoinProject(ws, userId, message);
                break;

            case MessageType.LEAVE_PROJECT:
                this._handleLeaveProject(ws, userId, message);
                break;

            case MessageType.PROJECT_EVENT:
                await this._handleProjectEvent(ws, userId, projectId, message);
                break;

            case MessageType.PRESENCE_UPDATE:
                this._handlePresenceUpdate(ws, userId, projectId, message);
                break;

            default:
                this._sendError(ws, projectId, message.messageId, 'UNKNOWN_TYPE',
                    `Unknown message type: '${type}'.`);
        }
    }

    // ----------------------------------------------------------------
    // Handlers
    // ----------------------------------------------------------------

    /**
     * JOIN_PROJECT: add the user to the specified project room.
     *
     * Expected message:
     *   { type, projectId, messageId, clientId, payload?: { meta?: object } }
     *
     * @param {import('ws').WebSocket} ws
     * @param {string} userId
     * @param {object} message
     */
    async _handleJoinProject(ws, userId, message) {
        const { projectId, messageId, payload } = message;
        const meta = payload?.meta ?? {};

        try {
            await this._rooms.joinRoom(projectId, userId, ws, meta);

            this._ack(ws, messageId, { joined: true, projectId });
        } catch (err) {
            const code = err.statusCode === 403 ? 'PERMISSION_DENIED' : 'JOIN_FAILED';
            this._sendError(ws, projectId, messageId, code, err.message);
        }
    }

    /**
     * LEAVE_PROJECT: remove the user from the specified project room.
     *
     * @param {import('ws').WebSocket} ws
     * @param {string} userId
     * @param {object} message
     */
    _handleLeaveProject(ws, userId, message) {
        const { projectId, messageId } = message;

        this._rooms.leaveRoom(projectId, userId);
        this._ack(ws, messageId, { left: true, projectId });
    }

    /**
     * PROJECT_EVENT: validate and fan-out a collaborative operation.
     *
     * The event is broadcast to all other members of the room.
     * The originating client receives an ACK.
     *
     * Expected payload:
     *   { eventType: string, data: object, version?: number }
     *
     * @param {import('ws').WebSocket} ws
     * @param {string} userId
     * @param {string|null} projectId
     * @param {object} message
     */
    async _handleProjectEvent(ws, userId, projectId, message) {
        const { messageId, payload } = message;

        if (!projectId) {
            this._sendError(ws, null, messageId, 'MISSING_PROJECT', 'projectId is required for PROJECT_EVENT.');
            return;
        }

        const { valid, errors } = this._validator.validateProjectEvent(payload);
        if (!valid) {
            this._sendError(ws, projectId, messageId, 'PAYLOAD_ERROR', errors.join('; '));
            return;
        }

        // Check the user is still in the room (re-join after eviction).
        const connected = this._rooms.getConnectedUsers(projectId);
        if (!connected.includes(userId)) {
            this._sendError(ws, projectId, messageId, 'NOT_IN_ROOM',
                'You must join the project room before sending events.');
            return;
        }

        // Broadcast to room peers.
        this._rooms.broadcast(projectId, {
            type:      MessageType.PROJECT_EVENT,
            projectId,
            messageId,
            senderId:  userId,
            payload,
            timestamp: new Date().toISOString(),
        }, userId);

        // ACK the sender.
        this._ack(ws, messageId, { projectId, broadcast: this._rooms.getRoomSize(projectId) - 1 });
    }

    /**
     * PRESENCE_UPDATE: update cursor / selection / status and broadcast.
     *
     * Expected payload: { status?, cursor?, selection?, displayName?, color? }
     *
     * @param {import('ws').WebSocket} ws
     * @param {string} userId
     * @param {string|null} projectId
     * @param {object} message
     */
    _handlePresenceUpdate(ws, userId, projectId, message) {
        const { messageId, payload } = message;

        if (!projectId) {
            this._sendError(ws, null, messageId, 'MISSING_PROJECT', 'projectId is required for PRESENCE_UPDATE.');
            return;
        }

        const { valid, errors } = this._validator.validatePresenceUpdate(payload);
        if (!valid) {
            this._sendError(ws, projectId, messageId, 'PAYLOAD_ERROR', errors.join('; '));
            return;
        }

        this._presence.updatePresence(projectId, userId, payload);

        this._rooms.broadcast(projectId, {
            type:      MessageType.PRESENCE_UPDATE,
            projectId,
            userId,
            payload,
            timestamp: new Date().toISOString(),
        }, userId);

        this._ack(ws, messageId, { updated: true });
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /**
     * @param {import('ws').WebSocket} ws
     * @param {string|null} messageId
     * @param {object} [data]
     */
    _ack(ws, messageId, data = {}) {
        this._send(ws, { type: MessageType.ACK, messageId, ...data });
    }

    /**
     * @param {import('ws').WebSocket} ws
     * @param {string|null} projectId
     * @param {string|null} messageId
     * @param {string} code
     * @param {string} detail
     */
    _sendError(ws, projectId, messageId, code, detail) {
        this._send(ws, {
            type:      MessageType.ERROR,
            projectId,
            messageId,
            error:     { code, detail },
            timestamp: new Date().toISOString(),
        });
    }

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
