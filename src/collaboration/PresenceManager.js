// =====================================================================
// PresenceManager – Phase J (Collaboration)
//
// Tracks which users are online in a collaborative session and which
// part each user currently has selected.
//
// Architecture:
//   • CollaborationTransport owns the Supabase Realtime channel and
//     surfaces presence events via onPresenceChange().
//   • PresenceManager listens to those events, maintains its own
//     in-memory presence map, and notifies subscribers.
// =====================================================================

export class PresenceManager {

    /**
     * @param {import('./CollaborationTransport.js').CollaborationTransport} transport
     * @param {import('../auth/AuthManager.js').AuthManager} authManager
     */
    constructor(transport, authManager) {
        if (!transport)    throw new Error('PresenceManager: transport is required.');
        if (!authManager)  throw new Error('PresenceManager: authManager is required.');

        this._transport  = transport;
        this._auth       = authManager;

        /** @type {Map<string, object>} userId → presence data */
        this._users       = new Map();
        this._projectId   = null;
        this._isStarted   = false;
        this._listeners   = new Set();

        // Keep a reference so we can unsubscribe later
        this._unsubscribePresence = null;
    }


    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /**
     * Begin tracking presence for the given project.
     * Must be called after the transport has connected.
     *
     * @param {string} projectId
     */
    start(projectId) {
        if (this._isStarted) this.stop();

        this._projectId = projectId;
        this._isStarted = true;

        // Subscribe to presence events from the transport
        this._unsubscribePresence = this._transport.onPresenceChange((event) => {
            switch (event.event) {
                case 'sync':  this._handlePresenceSync(event.state);  break;
                case 'join':  this._handlePresenceJoin(event.presences); break;
                case 'leave': this._handlePresenceLeave(event.presences); break;
                default: break;
            }
        });

        // Register current user's presence with the transport
        this._trackSelf();
    }

    /**
     * Stop tracking presence and clean up listeners.
     */
    stop() {
        if (this._unsubscribePresence) {
            this._unsubscribePresence();
            this._unsubscribePresence = null;
        }
        this._users.clear();
        this._projectId = null;
        this._isStarted = false;
        this._notify();
    }


    // ------------------------------------------------------------------
    // Updates
    // ------------------------------------------------------------------

    /**
     * Broadcast which part the current user has selected (or null).
     * @param {string|null} instanceId
     */
    updateSelection(instanceId) {
        const user = this._auth.currentUser;
        if (!user) return;

        // Update our local map immediately for snappy UI
        if (this._users.has(user.id)) {
            const existing = this._users.get(user.id);
            this._users.set(user.id, { ...existing, selectedInstanceId: instanceId });
            this._notify();
        }

        // Broadcast the updated presence payload via the transport
        if (this._transport.isConnected) {
            this._transport.trackPresence({
                userId:             user.id,
                displayName:        user.email ?? user.id,
                selectedInstanceId: instanceId,
            }).catch(err => {
                console.warn('PresenceManager.updateSelection: trackPresence failed', err);
            });
        }
    }


    // ------------------------------------------------------------------
    // Accessors
    // ------------------------------------------------------------------

    /**
     * All currently-online users including the current user.
     * @returns {Array<{userId:string,displayName:string,isOnline:boolean,lastSeen:string,selectedInstanceId:string|null}>}
     */
    get onlineUsers() {
        return Array.from(this._users.values());
    }


    // ------------------------------------------------------------------
    // Subscription
    // ------------------------------------------------------------------

    /**
     * Subscribe to presence list changes.
     * @param {function(Array): void} callback
     * @returns {function(): void} Unsubscribe function.
     */
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }


    // ------------------------------------------------------------------
    // Internal presence handlers
    // ------------------------------------------------------------------

    /**
     * Full-state sync from Supabase – rebuild user map from scratch.
     * @param {object} state – Supabase presence state keyed by presenceKey
     */
    _handlePresenceSync(state) {
        this._users.clear();

        for (const presences of Object.values(state ?? {})) {
            for (const presence of (Array.isArray(presences) ? presences : [presences])) {
                this._upsertUser(presence);
            }
        }

        this._notify();
    }

    /**
     * One or more users have joined the channel.
     * @param {object[]} joins – array of presence payloads
     */
    _handlePresenceJoin(joins) {
        for (const presence of (joins ?? [])) {
            this._upsertUser(presence);
        }
        this._notify();
    }

    /**
     * One or more users have left the channel.
     * @param {object[]} leaves – array of presence payloads
     */
    _handlePresenceLeave(leaves) {
        for (const presence of (leaves ?? [])) {
            const userId = presence?.userId;
            if (userId) {
                // Mark as offline rather than removing so the UI can show a brief "left" indicator
                const existing = this._users.get(userId);
                if (existing) {
                    this._users.set(userId, {
                        ...existing,
                        isOnline:  false,
                        lastSeen:  new Date().toISOString(),
                    });
                }
            }
        }
        this._notify();
    }


    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /**
     * Insert or update a user in the local presence map.
     * @param {object} presence
     */
    _upsertUser(presence) {
        if (!presence?.userId) return;

        this._users.set(presence.userId, {
            userId:             presence.userId,
            displayName:        presence.displayName ?? presence.userId,
            isOnline:           true,
            lastSeen:           new Date().toISOString(),
            selectedInstanceId: presence.selectedInstanceId ?? null,
        });
    }

    /**
     * Broadcast the current user's initial presence payload.
     */
    _trackSelf() {
        const user = this._auth.currentUser;
        if (!user || !this._transport.isConnected) return;

        this._transport.trackPresence({
            userId:             user.id,
            displayName:        user.email ?? user.id,
            selectedInstanceId: null,
        }).catch(err => {
            console.warn('PresenceManager._trackSelf: trackPresence failed', err);
        });
    }

    /** Notify all UI subscribers with the current user list. */
    _notify() {
        const users = this.onlineUsers;
        for (const cb of this._listeners) {
            try { cb(users); } catch (e) { console.error('PresenceManager subscriber error:', e); }
        }
    }
}
