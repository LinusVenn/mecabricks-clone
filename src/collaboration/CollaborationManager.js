// =====================================================================
// CollaborationManager – Phase J (Collaboration)
//
// Top-level coordinator for all real-time collaboration features.
//
// Responsibilities:
//   • Join / leave project channels via CollaborationTransport
//   • Load the current user's role via PermissionManager
//   • Route incoming messages through ConflictManager → OperationDispatcher
//   • Enqueue and send outgoing operations via OperationQueue + Transport
//   • Keep CollaborationState up-to-date and notify subscribers
//
// Collaboration message protocol (over Supabase Broadcast):
//   {
//     kind:      'OPERATION' | 'CURSOR' | 'PING',
//     projectId: string,
//     userId:    string,
//     ...operationFields
//   }
// =====================================================================

import { CollaborationState }  from './CollaborationState.js';
import { Operation, OperationType } from './OperationQueue.js';
import { TransportStatus }     from './CollaborationTransport.js';
import { ConflictResolution }  from './ConflictManager.js';


export class CollaborationManager {

    /**
     * @param {{
     *   supabaseClient:    object
     *   authManager:       import('../auth/AuthManager.js').AuthManager
     *   projectManager:    object
     *   cloudSyncManager:  object
     *   permissionManager: import('./PermissionManager.js').PermissionManager
     *   sharingManager:    import('./SharingManager.js').SharingManager
     *   versionManager:    import('./VersionManager.js').VersionManager
     *   operationQueue:    import('./OperationQueue.js').OperationQueue
     *   transport:         import('./CollaborationTransport.js').CollaborationTransport
     *   dispatcher:        import('./OperationDispatcher.js').OperationDispatcher
     *   conflictManager:   import('./ConflictManager.js').ConflictManager
     *   presenceManager:   import('./PresenceManager.js').PresenceManager
     * }} options
     */
    constructor({
        supabaseClient,
        authManager,
        projectManager,
        cloudSyncManager,
        permissionManager,
        sharingManager,
        versionManager,
        operationQueue,
        transport,
        dispatcher,
        conflictManager,
        presenceManager,
    }) {
        // ── Required dependencies ──────────────────────────────────────
        if (!supabaseClient)    throw new Error('CollaborationManager: supabaseClient is required.');
        if (!authManager)       throw new Error('CollaborationManager: authManager is required.');
        if (!permissionManager) throw new Error('CollaborationManager: permissionManager is required.');
        if (!operationQueue)    throw new Error('CollaborationManager: operationQueue is required.');
        if (!transport)         throw new Error('CollaborationManager: transport is required.');
        if (!dispatcher)        throw new Error('CollaborationManager: dispatcher is required.');
        if (!conflictManager)   throw new Error('CollaborationManager: conflictManager is required.');

        // ── Store all managers ─────────────────────────────────────────
        this._supabase   = supabaseClient;
        this._auth       = authManager;
        this._pm         = projectManager    ?? null;
        this._sync       = cloudSyncManager  ?? null;
        this._permission = permissionManager;
        this._sharing    = sharingManager    ?? null;
        this._versions   = versionManager    ?? null;
        this._queue      = operationQueue;
        this._transport  = transport;
        this._dispatcher = dispatcher;
        this._conflicts  = conflictManager;
        this._presence   = presenceManager   ?? null;

        // ── Public sub-managers ────────────────────────────────────────
        this.sharingManager  = this._sharing;
        this.versionManager  = this._versions;
        this.presenceManager = this._presence;

        // ── State ──────────────────────────────────────────────────────
        this._state      = CollaborationState.createLocal();
        this._listeners  = new Set();

        // ── Wire up transport callbacks ────────────────────────────────
        this._unsubMessage = this._transport.onMessage((msg) => this._handleIncomingMessage(msg));
        this._unsubStatus  = this._transport.onStatusChange((status) => {
            const connected = status === TransportStatus.CONNECTED;
            this._setState(this._state.with({ isConnected: connected }));
        });
    }


    // ------------------------------------------------------------------
    // Connection lifecycle
    // ------------------------------------------------------------------

    /**
     * Join the realtime channel for a project.
     *   1. Loads the user's role from Supabase
     *   2. Connects the transport
     *   3. Starts presence tracking
     *   4. Updates CollaborationState
     *
     * @param {string} projectId
     * @returns {Promise<CollaborationState>}
     */
    async joinProject(projectId) {
        const user = this._auth.currentUser;
        if (!user) throw new Error('CollaborationManager.joinProject: user must be logged in.');

        // ── 1. Determine role ──────────────────────────────────────────
        const role = await this._permission.loadRole(projectId, user.id);

        // ── 2. Connect transport ───────────────────────────────────────
        await this._transport.connect(projectId);

        // ── 3. Start presence ──────────────────────────────────────────
        if (this._presence) {
            await this._presence.start(projectId);
        }

        // ── 4. Update state ────────────────────────────────────────────
        this._setState(new CollaborationState({
            projectId,
            role,
            isConnected:    true,
            members:        [],
            sequenceNumber: 0,
        }));

        return this._state;
    }

    /**
     * Leave the current project's realtime channel and clean up.
     * @returns {Promise<void>}
     */
    async leaveProject() {
        if (this._presence) {
            await this._presence.stop();
        }

        await this._transport.disconnect();
        this._queue.clear();
        this._permission.clearRole();

        this._setState(CollaborationState.createLocal());
    }


    // ------------------------------------------------------------------
    // Outgoing operations
    // ------------------------------------------------------------------

    /**
     * Create and send an operation to all collaborators.
     *
     * @param {string} type     – one of OperationType
     * @param {object} payload  – operation-specific data
     * @returns {Promise<Operation>}
     */
    async sendOperation(type, payload) {
        const user = this._auth.currentUser;
        if (!user) throw new Error('CollaborationManager.sendOperation: not authenticated.');

        if (!this._state.canEdit) {
            throw new Error('CollaborationManager.sendOperation: insufficient permissions (viewer only).');
        }

        const operation = Operation.create(type, this._state.projectId, user.id, payload);

        // Enqueue for acknowledgement tracking
        this._queue.enqueue(operation);

        // Send via transport
        await this._transport.send({
            kind:        'OPERATION',
            ...operation.toJSON(),
        });

        return operation;
    }


    // ------------------------------------------------------------------
    // State accessors
    // ------------------------------------------------------------------

    /**
     * Current immutable collaboration state.
     * @returns {CollaborationState}
     */
    get state() { return this._state; }

    /**
     * True if currently connected to a project channel.
     * @returns {boolean}
     */
    get isCollaborating() {
        return this._state.isConnected && !!this._state.projectId;
    }

    /**
     * Subscribe to state changes.
     *
     * @param {function(CollaborationState): void} callback
     * @returns {function(): void} Unsubscribe
     */
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }


    // ------------------------------------------------------------------
    // Internal message handling
    // ------------------------------------------------------------------

    /**
     * Entry-point for all messages received from the Realtime channel.
     *
     * @param {object} message
     */
    async _handleIncomingMessage(message) {
        try {
            if (!message || !message.kind) return;

            switch (message.kind) {
                case 'OPERATION':
                    await this._handleOperation(message);
                    break;

                case 'CURSOR':
                    // Presence selection updates are handled by PresenceManager directly
                    break;

                case 'PING':
                    // Keep-alive; no action required
                    break;

                default:
                    console.warn(`CollaborationManager: unknown message kind "${message.kind}"`);
            }
        } catch (err) {
            this._handleError(err);
        }
    }

    /**
     * Process an incoming OPERATION message.
     *
     * @param {object} message
     */
    async _handleOperation(message) {
        const user = this._auth.currentUser;

        // Ignore our own echoes
        if (user && message.userId === user.id && this._queue.has(message.operationId)) {
            // This is our own op confirmed by the server – acknowledge it
            this._queue.acknowledge(message.operationId, message.sequenceNumber ?? 0);

            // Advance the local sequence number
            if (message.sequenceNumber !== undefined) {
                this._setState(this._state.with({ sequenceNumber: message.sequenceNumber }));
            }
            return;
        }

        // Reconstruct the incoming Operation
        const incomingOp = Operation.fromJSON(message);

        // Conflict check against pending local operations
        const pendingLocal = this._queue.pending;
        const resolution   = this._conflicts.checkConflict(incomingOp, pendingLocal);

        if (resolution === ConflictResolution.SKIP) {
            console.debug('CollaborationManager: skipping conflicting incoming op', incomingOp.operationId);
            return;
        }

        // Dispatch to the editor
        const applied = await this._dispatcher.dispatch(incomingOp);

        if (applied && message.sequenceNumber !== undefined) {
            this._setState(this._state.with({ sequenceNumber: message.sequenceNumber }));
        }
    }

    /**
     * Handle an error in the collaboration pipeline.
     *
     * @param {Error} error
     */
    _handleError(error) {
        console.error('CollaborationManager error:', error);
        // Could surface to UI via a dedicated error event; for now just log.
    }


    // ------------------------------------------------------------------
    // Internal state management
    // ------------------------------------------------------------------

    /**
     * Update internal state and notify all subscribers.
     *
     * @param {CollaborationState} newState
     */
    _setState(newState) {
        this._state = newState;
        for (const cb of this._listeners) {
            try { cb(this._state); } catch (e) {
                console.error('CollaborationManager subscriber error:', e);
            }
        }
    }

    /**
     * Dispose all transport listeners (call when the manager is no longer needed).
     */
    destroy() {
        if (this._unsubMessage) this._unsubMessage();
        if (this._unsubStatus)  this._unsubStatus();
    }
}
