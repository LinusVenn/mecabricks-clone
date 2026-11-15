/**
 * WebSocketServer.js
 *
 * Wraps the `ws` package's WebSocket.Server to handle:
 *   1. HTTP → WebSocket upgrade authentication (JWT from cookie or ?token= query param).
 *   2. Per-connection lifecycle: open, message, close, error.
 *   3. Delegation of all business logic to ProjectRoomManager / MessageRouter.
 *
 * Usage:
 *   const wss = new WebSocketServer({ server, permissionService, projectRoomManager, messageRouter });
 *   wss.start();
 *
 * The JWT is verified via the Supabase admin client so it stays consistent
 * with the rest of the auth layer.
 */

import { WebSocketServer as WsServer } from 'ws';
import { parse as parseUrl }           from 'node:url';
import { parse as parseCookie }        from 'node:querystring';

/** Close codes used by this server. */
export const WsCloseCodes = {
    NORMAL:           1000,
    AUTH_REQUIRED:    4001,
    TOKEN_INVALID:    4002,
    INTERNAL_ERROR:   4003,
    PERMISSION_ERROR: 4004,
};

export class WebSocketServer {
    /**
     * @param {{
     *   server:             import('http').Server,
     *   supabaseAdminClient: import('@supabase/supabase-js').SupabaseClient,
     *   permissionService:  import('../services/PermissionService.js').PermissionService,
     *   projectRoomManager: import('./ProjectRoomManager.js').ProjectRoomManager,
     *   messageRouter:      import('./MessageRouter.js').MessageRouter,
     *   path?:              string   – WebSocket endpoint path (default: '/ws')
     * }} options
     */
    constructor({
        server,
        supabaseAdminClient,
        permissionService,
        projectRoomManager,
        messageRouter,
        path = '/ws',
    }) {
        if (!server)             throw new Error('WebSocketServer: server is required.');
        if (!supabaseAdminClient) throw new Error('WebSocketServer: supabaseAdminClient is required.');
        if (!projectRoomManager) throw new Error('WebSocketServer: projectRoomManager is required.');
        if (!messageRouter)      throw new Error('WebSocketServer: messageRouter is required.');

        this._httpServer        = server;
        this._supabase          = supabaseAdminClient;
        this._permissions       = permissionService;
        this._rooms             = projectRoomManager;
        this._messageRouter     = messageRouter;
        this._path              = path;

        /** @type {WsServer|null} */
        this._wss = null;
    }

    // ----------------------------------------------------------------
    // Lifecycle
    // ----------------------------------------------------------------

    /** Attach the WebSocket server to the HTTP server. */
    start() {
        if (this._wss) return; // already started

        this._wss = new WsServer({
            server:     this._httpServer,
            path:       this._path,
            // Disable per-message compression for lowest latency.
            perMessageDeflate: false,
        });

        this._wss.on('connection', this._handleUpgrade.bind(this));
        this._wss.on('error', (err) => {
            console.error('[WebSocketServer] Server-level error:', err);
        });

        console.info(`[WebSocketServer] Listening on ${this._path}`);
    }

    /** Gracefully shut down and close all connections. */
    stop() {
        return new Promise((resolve) => {
            if (!this._wss) return resolve();

            this._wss.clients.forEach((ws) => {
                ws.close(WsCloseCodes.NORMAL, 'Server shutting down.');
            });

            this._wss.close(() => {
                this._wss = null;
                console.info('[WebSocketServer] Stopped.');
                resolve();
            });
        });
    }

    // ----------------------------------------------------------------
    // Connection handling
    // ----------------------------------------------------------------

    /**
     * Called for every new WebSocket connection.
     *
     * @param {import('ws').WebSocket} ws
     * @param {import('http').IncomingMessage} req
     */
    async _handleUpgrade(ws, req) {
        let userId;

        try {
            userId = await this._authenticate(req);
        } catch (authErr) {
            console.warn('[WebSocketServer] Auth failed:', authErr.message);
            ws.close(WsCloseCodes.TOKEN_INVALID, 'Authentication failed.');
            return;
        }

        if (!userId) {
            ws.close(WsCloseCodes.AUTH_REQUIRED, 'Token missing.');
            return;
        }

        // Attach metadata to the socket for debugging.
        ws._userId = userId;

        ws.on('message', (rawData) => {
            this._handleMessage(ws, userId, rawData).catch((err) => {
                console.error('[WebSocketServer] Unhandled message error:', err);
                this._sendError(ws, null, null, 'INTERNAL_ERROR', err.message);
            });
        });

        ws.on('close', (code, reason) => {
            this._handleClose(ws, userId, code, reason?.toString());
        });

        ws.on('error', (err) => {
            console.error(`[WebSocketServer] Socket error for user ${userId}:`, err.message);
        });

        // Send a welcome frame so the client knows auth succeeded.
        this._send(ws, { type: 'CONNECTED', userId });
    }

    // ----------------------------------------------------------------
    // Authentication
    // ----------------------------------------------------------------

    /**
     * Extract and verify the JWT, returning the user UUID.
     *
     * Token is resolved in this priority order:
     *   1. Cookie: `sb-access-token`
     *   2. Query parameter: `?token=`
     *
     * @param {import('http').IncomingMessage} req
     * @returns {Promise<string>} userId
     * @throws {Error} If the token is missing or invalid.
     */
    async _authenticate(req) {
        const { query, } = parseUrl(req.url ?? '', true);
        let token = query.token ?? null;

        // Try cookie if no query param.
        if (!token && req.headers.cookie) {
            const cookies = parseCookie(req.headers.cookie.replace(/;\s*/g, '&'));
            token = cookies['sb-access-token'] ?? null;
        }

        if (!token) {
            throw new Error('No authentication token provided.');
        }

        const { data, error } = await this._supabase.auth.getUser(token);

        if (error || !data?.user) {
            throw new Error(error?.message ?? 'Invalid token.');
        }

        return data.user.id;
    }

    // ----------------------------------------------------------------
    // Message handling
    // ----------------------------------------------------------------

    /**
     * Parse and route an incoming WebSocket message.
     *
     * @param {import('ws').WebSocket} ws
     * @param {string} userId
     * @param {Buffer|string} rawData
     */
    async _handleMessage(ws, userId, rawData) {
        let message;

        try {
            message = JSON.parse(rawData.toString());
        } catch {
            this._sendError(ws, null, null, 'PARSE_ERROR', 'Message must be valid JSON.');
            return;
        }

        const projectId = message?.projectId ?? null;

        try {
            await this._messageRouter.route(ws, userId, projectId, message);
        } catch (err) {
            this._sendError(ws, projectId, message?.messageId, 'ROUTE_ERROR', err.message);
        }
    }

    /**
     * Clean up rooms when a connection closes.
     *
     * @param {import('ws').WebSocket} ws
     * @param {string} userId
     * @param {number} code
     * @param {string} reason
     */
    _handleClose(ws, userId, code, reason) {
        this._rooms.leaveAllRooms(userId);
        console.info(`[WebSocketServer] User ${userId} disconnected (code: ${code}).`);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /**
     * Serialize and send a message to a single WebSocket client.
     *
     * @param {import('ws').WebSocket} ws
     * @param {object} payload
     */
    _send(ws, payload) {
        if (ws.readyState !== ws.constructor.OPEN) return;
        ws.send(JSON.stringify(payload));
    }

    /**
     * Send a structured error frame to a client.
     *
     * @param {import('ws').WebSocket} ws
     * @param {string|null} projectId
     * @param {string|null} messageId   Echo the original messageId for correlation.
     * @param {string} code             Machine-readable error code.
     * @param {string} detail           Human-readable description.
     */
    _sendError(ws, projectId, messageId, code, detail) {
        this._send(ws, {
            type:      'ERROR',
            projectId,
            messageId,
            error:     { code, detail },
            timestamp: new Date().toISOString(),
        });
    }
}
