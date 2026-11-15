// =====================================================================
// CollaborationTransport – Phase J (Collaboration)
//
// WebSocket transport layer built on top of Supabase Realtime.
// Handles connection lifecycle, broadcast messaging, and presence tracking.
//
// Channel convention: `project:<projectId>`
//
// Supabase Realtime status values passed to subscribe callback:
//   'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'
// =====================================================================

export const TransportStatus = Object.freeze({
    DISCONNECTED: 'disconnected',
    CONNECTING:   'connecting',
    CONNECTED:    'connected',
    ERROR:        'error',
});


/** The single broadcast event name used on every Realtime channel. */
const BROADCAST_EVENT = 'PROJECT_EVENT';


export class CollaborationTransport {

    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
     * @param {import('../auth/AuthManager.js').AuthManager}   authManager
     */
    constructor(supabaseClient, authManager) {
        if (!supabaseClient) throw new Error('CollaborationTransport: supabaseClient is required.');
        if (!authManager)    throw new Error('CollaborationTransport: authManager is required.');

        this._supabase   = supabaseClient;
        this._auth       = authManager;

        /** @type {import('@supabase/supabase-js').RealtimeChannel|null} */
        this._channel    = null;
        this._projectId  = null;
        this._status     = TransportStatus.DISCONNECTED;

        // Subscriber lists
        this._messageHandlers  = new Set();
        this._statusHandlers   = new Set();
        this._presenceHandlers = new Set();
    }


    // ------------------------------------------------------------------
    // Connection lifecycle
    // ------------------------------------------------------------------

    /**
     * Join the Supabase Realtime channel for the given project.
     * Resolves once the channel reaches SUBSCRIBED status.
     *
     * @param {string} projectId
     * @returns {Promise<void>}
     */
    async connect(projectId) {
        if (this._channel) {
            await this.disconnect();
        }

        this._projectId = projectId;
        this._setStatus(TransportStatus.CONNECTING);

        return new Promise((resolve, reject) => {
            this._channel = this._supabase
                .channel(`project:${projectId}`)
                // Incoming broadcast operations
                .on('broadcast', { event: BROADCAST_EVENT }, (payload) => {
                    this._onBroadcast(payload);
                })
                // Presence sync (full state refresh)
                .on('presence', { event: 'sync' }, () => {
                    this._onPresenceSync();
                })
                // Presence join (new user arrived)
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    this._onPresenceJoin(key, newPresences);
                })
                // Presence leave (user disconnected)
                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                    this._onPresenceLeave(key, leftPresences);
                })
                .subscribe((supabaseStatus) => {
                    this._handleSubscribeStatus(supabaseStatus, resolve, reject);
                });
        });
    }

    /**
     * Leave the channel and clean up all listeners.
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (!this._channel) return;

        try {
            await this._supabase.removeChannel(this._channel);
        } catch (err) {
            console.warn('CollaborationTransport.disconnect: error removing channel', err);
        }

        this._channel   = null;
        this._projectId = null;
        this._setStatus(TransportStatus.DISCONNECTED);
    }


    // ------------------------------------------------------------------
    // Sending
    // ------------------------------------------------------------------

    /**
     * Broadcast a message to all other clients on the channel.
     * The message is delivered as a Supabase broadcast payload.
     *
     * @param {object} message – any JSON-serialisable object
     * @throws {Error} If not connected.
     */
    send(message) {
        if (!this._channel || this._status !== TransportStatus.CONNECTED) {
            throw new Error('CollaborationTransport.send: not connected.');
        }

        this._channel.send({
            type:    'broadcast',
            event:   BROADCAST_EVENT,
            payload: message,
        });
    }


    // ------------------------------------------------------------------
    // Presence
    // ------------------------------------------------------------------

    /**
     * Begin tracking the current user's presence on the channel.
     * Call after connect() so the channel exists.
     *
     * @param {{ userId: string, displayName: string, selectedInstanceId?: string|null }} presenceData
     */
    async trackPresence(presenceData) {
        if (!this._channel) {
            throw new Error('CollaborationTransport.trackPresence: not connected.');
        }
        await this._channel.track({
            userId:             presenceData.userId,
            displayName:        presenceData.displayName,
            selectedInstanceId: presenceData.selectedInstanceId ?? null,
        });
    }

    /**
     * Get the current presence state of all tracked users.
     * @returns {object} Raw Supabase presence state (keyed by presenceKey).
     */
    getPresenceState() {
        if (!this._channel) return {};
        return this._channel.presenceState();
    }


    // ------------------------------------------------------------------
    // Accessors
    // ------------------------------------------------------------------

    /** @returns {TransportStatus} */
    get status()    { return this._status; }

    /** @returns {string|null} */
    get projectId() { return this._projectId; }

    /** @returns {boolean} */
    get isConnected() { return this._status === TransportStatus.CONNECTED; }


    // ------------------------------------------------------------------
    // Subscriptions
    // ------------------------------------------------------------------

    /**
     * Register a callback for incoming broadcast messages.
     * @param {function(object): void} callback
     * @returns {function(): void} Unsubscribe.
     */
    onMessage(callback) {
        this._messageHandlers.add(callback);
        return () => this._messageHandlers.delete(callback);
    }

    /**
     * Register a callback for connection-status changes.
     * @param {function(TransportStatus): void} callback
     * @returns {function(): void} Unsubscribe.
     */
    onStatusChange(callback) {
        this._statusHandlers.add(callback);
        return () => this._statusHandlers.delete(callback);
    }

    /**
     * Register a callback for presence changes (join / leave / sync).
     * @param {function({event:string, state:object}): void} callback
     * @returns {function(): void} Unsubscribe.
     */
    onPresenceChange(callback) {
        this._presenceHandlers.add(callback);
        return () => this._presenceHandlers.delete(callback);
    }


    // ------------------------------------------------------------------
    // Internal handlers
    // ------------------------------------------------------------------

    /** Called when a broadcast arrives on the channel. */
    _onBroadcast(envelope) {
        // Supabase wraps the payload in { payload: { ... } }
        const message = envelope?.payload ?? envelope;
        for (const cb of this._messageHandlers) {
            try { cb(message); } catch (e) { console.error('CollaborationTransport message handler error:', e); }
        }
    }

    /** Called on a presence 'sync' event (full snapshot). */
    _onPresenceSync() {
        const state = this.getPresenceState();
        this._notifyPresence({ event: 'sync', state });
    }

    /** Called when a new presence joins. */
    _onPresenceJoin(key, newPresences) {
        this._notifyPresence({ event: 'join', key, presences: newPresences, state: this.getPresenceState() });
    }

    /** Called when a presence leaves. */
    _onPresenceLeave(key, leftPresences) {
        this._notifyPresence({ event: 'leave', key, presences: leftPresences, state: this.getPresenceState() });
    }

    /**
     * Translate Supabase subscribe status strings into TransportStatus values.
     * Resolves / rejects the connect() promise.
     */
    _handleSubscribeStatus(supabaseStatus, resolve, reject) {
        switch (supabaseStatus) {
            case 'SUBSCRIBED':
                this._setStatus(TransportStatus.CONNECTED);
                resolve();
                break;
            case 'TIMED_OUT':
            case 'CHANNEL_ERROR':
                this._setStatus(TransportStatus.ERROR);
                reject(new Error(`CollaborationTransport: channel error – ${supabaseStatus}`));
                break;
            case 'CLOSED':
                this._setStatus(TransportStatus.DISCONNECTED);
                break;
            default:
                // Intermediate states (e.g. 'CONNECTING') – no action needed
                break;
        }
    }

    /** Update internal status and notify subscribers. */
    _setStatus(newStatus) {
        if (newStatus === this._status) return;
        this._status = newStatus;
        for (const cb of this._statusHandlers) {
            try { cb(newStatus); } catch (e) { console.error('CollaborationTransport status handler error:', e); }
        }
    }

    /** Notify presence subscribers. */
    _notifyPresence(event) {
        for (const cb of this._presenceHandlers) {
            try { cb(event); } catch (e) { console.error('CollaborationTransport presence handler error:', e); }
        }
    }
}
