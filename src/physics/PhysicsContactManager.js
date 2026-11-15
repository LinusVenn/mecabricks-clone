/**
 * PhysicsContactManager – Wertet Kontakte und Kollisionsereignisse aus (Phase G.3)
 *
 * Registriert Kontaktereignisse aus der Physik-Welt und leitet sie
 * an registrierte Handler weiter.
 *
 * Unterstützt:
 *  - Kontaktbeginn / -ende
 *  - Kontaktposition und -normal
 *  - Kontaktkraft
 *  - Events für ausgewählte Instanzen
 *
 * Integration pattern:
 *   const contacts = new PhysicsContactManager({ physicsWorld: world });
 *
 *   // Register handlers before the first step
 *   const unsub = contacts.onContactStart(evt => console.log('contact!', evt));
 *
 *   // Each frame:
 *   contacts.processContacts(world, instanceIdMap);
 *   world.step(eventQueue);
 *
 *   // Cleanup
 *   unsub();
 *   contacts.clear();
 */

// ---------------------------------------------------------------------------

/**
 * @typedef {object} ContactInfo
 * @property {string}            instanceIdA
 * @property {string}            instanceIdB
 * @property {{x,y,z}}          contactPoint  Average contact position (world space)
 * @property {{x,y,z}}          normal         Contact normal pointing from B → A
 * @property {number}            impulse        Estimated contact impulse magnitude (N·s)
 * @property {number}            timestamp      performance.now() at event creation
 */

/**
 * @typedef {(event: ContactInfo) => void} ContactHandler
 */

export class PhysicsContactManager {

    // ------------------------------------------------------------------
    // Construction
    // ------------------------------------------------------------------

    /**
     * @param {{ physicsWorld: object }} options
     *   physicsWorld – Rapier World instance.  May be updated later via setWorld().
     */
    constructor({ physicsWorld }) {
        if (!physicsWorld) {
            throw new Error('[PhysicsContactManager] physicsWorld is required');
        }

        /** @private */
        this._world = physicsWorld;

        /**
         * Subscribed "contact start" handlers.
         * @private @type {Set<ContactHandler>}
         */
        this._startHandlers = new Set();

        /**
         * Subscribed "contact end" handlers.
         * @private @type {Set<ContactHandler>}
         */
        this._endHandlers = new Set();

        /**
         * Currently active contact pairs.
         * Key: canonical pair key "idA|idB" (idA < idB lexicographically)
         * Value: ContactInfo
         * @private @type {Map<string, ContactInfo>}
         */
        this._activeContacts = new Map();

        /**
         * Contact keys seen in the last processContacts() call.
         * Used to detect contact-end events.
         * @private @type {Set<string>}
         */
        this._previousKeys = new Set();

        /**
         * Rapier EventQueue for contact events (allocated lazily).
         * @private
         */
        this._eventQueue = null;
    }

    // ------------------------------------------------------------------
    // Subscription API
    // ------------------------------------------------------------------

    /**
     * Registers a handler that fires when a new contact pair begins.
     *
     * @param {ContactHandler} handler
     * @returns {() => void}  Unsubscribe function
     */
    onContactStart(handler) {
        if (typeof handler !== 'function') {
            throw new TypeError('[PhysicsContactManager] onContactStart: handler must be a function');
        }
        this._startHandlers.add(handler);
        return () => this._startHandlers.delete(handler);
    }

    /**
     * Registers a handler that fires when an existing contact pair ends.
     *
     * @param {ContactHandler} handler
     * @returns {() => void}  Unsubscribe function
     */
    onContactEnd(handler) {
        if (typeof handler !== 'function') {
            throw new TypeError('[PhysicsContactManager] onContactEnd: handler must be a function');
        }
        this._endHandlers.add(handler);
        return () => this._endHandlers.delete(handler);
    }

    // ------------------------------------------------------------------
    // Per-step processing
    // ------------------------------------------------------------------

    /**
     * Processes the current contact state of the physics world and fires
     * registered handlers for newly started and newly ended contacts.
     *
     * Call this each simulation step, AFTER `world.step()` returns.
     *
     * @param {object} world          Rapier World (same or different from constructor)
     * @param {Map<number, string>} instanceIdMap
     *   Maps Rapier RigidBody handle → application instance ID
     */
    processContacts(world = this._world, instanceIdMap) {
        if (!world || !instanceIdMap) return;

        const currentKeys = new Set();
        const freshContacts = new Map();

        try {
            // ── Iterate every contact pair in the world ──────────────────
            world.contactPairs?.((colliderA, colliderB, contactPair) => {
                // Guard: only handle pairs that have actual contact points
                if (!contactPair.hasAny) return;

                // Resolve body handles → instance IDs
                const bodyHandleA = colliderA.parent?.()?.handle ?? -1;
                const bodyHandleB = colliderB.parent?.()?.handle ?? -1;

                const instanceIdA = instanceIdMap.get(bodyHandleA) ?? String(bodyHandleA);
                const instanceIdB = instanceIdMap.get(bodyHandleB) ?? String(bodyHandleB);

                const key = PhysicsContactManager._pairKey(instanceIdA, instanceIdB);
                currentKeys.add(key);

                // Compute average contact data from all contact points
                const contactInfo = this._extractContactInfo(
                    instanceIdA, instanceIdB,
                    contactPair,
                    /* isAFirst */ instanceIdA <= instanceIdB
                );

                freshContacts.set(key, contactInfo);
            });
        } catch (err) {
            console.warn('[PhysicsContactManager] Error iterating contact pairs:', err);
        }

        // ── Detect new contacts (start events) ───────────────────────────
        for (const [key, info] of freshContacts) {
            if (!this._previousKeys.has(key)) {
                this._activeContacts.set(key, info);
                this._fire(this._startHandlers, info);
            } else {
                // Update position/normal/impulse in place
                this._activeContacts.set(key, info);
            }
        }

        // ── Detect ended contacts (end events) ───────────────────────────
        for (const key of this._previousKeys) {
            if (!currentKeys.has(key)) {
                const info = this._activeContacts.get(key);
                this._activeContacts.delete(key);
                if (info) this._fire(this._endHandlers, info);
            }
        }

        this._previousKeys = currentKeys;
    }

    // ------------------------------------------------------------------
    // Queries
    // ------------------------------------------------------------------

    /**
     * Returns all currently active contact pairs.
     *
     * @returns {ContactInfo[]}
     */
    getActiveContacts() {
        return Array.from(this._activeContacts.values());
    }

    /**
     * Returns all active contacts that involve a specific instance (either side).
     *
     * @param {string} instanceId
     * @returns {ContactInfo[]}
     */
    getContactsForInstance(instanceId) {
        const result = [];
        for (const info of this._activeContacts.values()) {
            if (info.instanceIdA === instanceId || info.instanceIdB === instanceId) {
                result.push(info);
            }
        }
        return result;
    }

    /**
     * Returns the count of currently active contact pairs.
     *
     * @returns {number}
     */
    getActiveContactCount() {
        return this._activeContacts.size;
    }

    // ------------------------------------------------------------------
    // World reference
    // ------------------------------------------------------------------

    /**
     * Replaces the physics world reference (e.g. after a world reset).
     *
     * @param {object} physicsWorld
     */
    setWorld(physicsWorld) {
        this._world = physicsWorld;
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /**
     * Clears all active contacts and fires end-events for each of them.
     * Does NOT remove registered handlers.
     */
    clear() {
        for (const info of this._activeContacts.values()) {
            this._fire(this._endHandlers, info);
        }
        this._activeContacts.clear();
        this._previousKeys.clear();
    }

    /**
     * Removes all registered handlers and clears state.
     * Call this when the manager is no longer needed.
     */
    destroy() {
        this._startHandlers.clear();
        this._endHandlers.clear();
        this._activeContacts.clear();
        this._previousKeys.clear();
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    /**
     * Extracts averaged contact position, normal, and impulse from a
     * Rapier ContactPair.
     *
     * Rapier ContactPair may expose:
     *   contactPair.numContacts()          → number of contact points
     *   contactPair.contactPoint(i)        → { x, y, z }  (world space)
     *   contactPair.contactNormal(i)       → { x, y, z }
     *   contactPair.contactImpulse(i)      → number (N·s, last step)
     *
     * @param {string}  instanceIdA
     * @param {string}  instanceIdB
     * @param {object}  contactPair   Rapier ContactPair
     * @param {boolean} isAFirst      true if idA ≤ idB lexicographically
     * @returns {ContactInfo}
     * @private
     */
    _extractContactInfo(instanceIdA, instanceIdB, contactPair, isAFirst) {
        let sumX = 0, sumY = 0, sumZ = 0;
        let normX = 0, normY = 0, normZ = 0;
        let totalImpulse = 0;
        let count = 0;

        try {
            const n = contactPair.numContacts?.() ?? 0;
            for (let i = 0; i < n; i++) {
                const pt = contactPair.contactPoint?.(i);
                if (pt) { sumX += pt.x; sumY += pt.y; sumZ += pt.z; }

                const nv = contactPair.contactNormal?.(i);
                if (nv) { normX += nv.x; normY += nv.y; normZ += nv.z; }

                totalImpulse += contactPair.contactImpulse?.(i) ?? 0;
                count++;
            }
        } catch (_) { /* Rapier API variations — ignore individual point errors */ }

        const inv = count > 0 ? 1 / count : 1;
        const nLen = Math.sqrt(normX * normX + normY * normY + normZ * normZ) || 1;

        // Ensure normal points from B → A (convention)
        const sign = isAFirst ? 1 : -1;

        return {
            instanceIdA,
            instanceIdB,
            contactPoint: {
                x: sumX * inv,
                y: sumY * inv,
                z: sumZ * inv,
            },
            normal: {
                x: sign * normX / nLen,
                y: sign * normY / nLen,
                z: sign * normZ / nLen,
            },
            impulse:   totalImpulse,
            timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        };
    }

    /**
     * Fires all handlers in a set, catching individual errors.
     *
     * @param {Set<ContactHandler>} handlers
     * @param {ContactInfo}         event
     * @private
     */
    _fire(handlers, event) {
        for (const h of handlers) {
            try {
                h(event);
            } catch (err) {
                console.error('[PhysicsContactManager] Handler error:', err);
            }
        }
    }

    /**
     * Returns a canonical key for a contact pair that is independent of
     * argument order.
     *
     * @param {string} idA
     * @param {string} idB
     * @returns {string}
     * @private
     */
    static _pairKey(idA, idB) {
        return idA <= idB ? `${idA}|${idB}` : `${idB}|${idA}`;
    }
}
