// =====================================================================
// OperationQueue – Phase J (Collaboration)
//
// Manages outgoing operations before they are confirmed by the server.
//
// Flow:
//   1. Client performs an edit → creates an Operation and enqueues it.
//   2. The operation is sent to the Realtime channel.
//   3. Server broadcasts the confirmed operation back with a sequence number.
//   4. Client calls acknowledge(operationId, sequenceNumber) to mark it done.
//   5. Pending operations can be replayed after a reconnect via
//      getPendingAfter(lastKnownSequenceNumber).
//
// All mutations notify subscribed callbacks so UI can react (e.g.,
// show a "saving\u2026" indicator while the queue is non-empty).
// =====================================================================


/**
 * Known operation types that can be placed on the queue.
 * @readonly
 * @enum {string}
 */
export const OperationType = Object.freeze({
    PART_PLACED:          'PART_PLACED',
    PART_REMOVED:         'PART_REMOVED',
    PART_TRANSFORMED:     'PART_TRANSFORMED',
    PART_COLOR_CHANGED:   'PART_COLOR_CHANGED',
    PART_VARIANT_CHANGED: 'PART_VARIANT_CHANGED',
    GROUP_CREATED:        'GROUP_CREATED',
    GROUP_UPDATED:        'GROUP_UPDATED',
    GROUP_REMOVED:        'GROUP_REMOVED',
    GROUPS_SPLIT:         'GROUPS_SPLIT',
    GROUP_MEMBERSHIP_CHANGED: 'GROUP_MEMBERSHIP_CHANGED',
    CONNECTION_CREATED:   'CONNECTION_CREATED',
    CONNECTION_REMOVED:   'CONNECTION_REMOVED',
    ASSEMBLY_UPDATED:     'ASSEMBLY_UPDATED',

    // ── Phase K – Modellierungswerkzeuge ──────────────────────────────
    PARTS_ALIGNED:        'PARTS_ALIGNED',        // K.2 Ausrichtungsoperation
    PARTS_DUPLICATED:     'PARTS_DUPLICATED',      // K.3 Duplizierung
    PARTS_REMOVED_BATCH:  'PARTS_REMOVED_BATCH',   // K.3 Undo-Gegenoperation für Duplizierung
    PATTERN_CREATED:      'PATTERN_CREATED',       // K.3 Muster-Erstellung
    ASSEMBLY_LOCKED:      'ASSEMBLY_LOCKED',       // K.5 Baugruppe gesperrt
    ASSEMBLY_UNLOCKED:    'ASSEMBLY_UNLOCKED',     // K.5 Baugruppe entsperrt
});


/**
 * Immutable value object representing a single collaborative edit operation.
 */
export class Operation {

    /**
     * @param {{
     *   type:           string   - one of OperationType
     *   operationId:    string   - UUID
     *   projectId:      string
     *   userId:         string
     *   payload:        object   - operation-specific data
     *   sequenceNumber: number|null - null until acknowledged by server
     *   timestamp:      string   - ISO 8601 creation time
     * }} options
     */
    constructor({
        type,
        operationId,
        projectId,
        userId,
        payload,
        sequenceNumber = null,
        timestamp      = new Date().toISOString(),
    }) {
        if (!type)        throw new Error('Operation: type is required.');
        if (!operationId) throw new Error('Operation: operationId is required.');
        if (!projectId)   throw new Error('Operation: projectId is required.');
        if (!userId)      throw new Error('Operation: userId is required.');

        this._type           = type;
        this._operationId    = operationId;
        this._projectId      = projectId;
        this._userId         = userId;
        this._payload        = Object.freeze({ ...payload });
        this._sequenceNumber = sequenceNumber;
        this._timestamp      = timestamp;

        Object.freeze(this);
    }

    // Accessors
    get type()           { return this._type; }
    get operationId()    { return this._operationId; }
    get projectId()      { return this._projectId; }
    get userId()         { return this._userId; }
    get payload()        { return this._payload; }
    get sequenceNumber() { return this._sequenceNumber; }
    get timestamp()      { return this._timestamp; }

    /** True once the server has confirmed this operation with a sequence number. */
    get isAcknowledged() { return this._sequenceNumber !== null; }

    /**
     * Returns a NEW Operation with the given sequence number applied.
     * Does not mutate the original.
     *
     * @param {number} sequenceNumber
     * @returns {Operation}
     */
    acknowledge(sequenceNumber) {
        return new Operation({
            type:           this._type,
            operationId:    this._operationId,
            projectId:      this._projectId,
            userId:         this._userId,
            payload:        this._payload,
            sequenceNumber,
            timestamp:      this._timestamp,
        });
    }

    /** @returns {object} Plain JSON-serialisable representation. */
    toJSON() {
        return {
            type:           this._type,
            operationId:    this._operationId,
            projectId:      this._projectId,
            userId:         this._userId,
            payload:        this._payload,
            sequenceNumber: this._sequenceNumber,
            timestamp:      this._timestamp,
        };
    }

    /**
     * Reconstruct an Operation from a plain object.
     * @param {object} json
     * @returns {Operation}
     */
    static fromJSON(json) {
        return new Operation({
            type:           json.type,
            operationId:    json.operationId,
            projectId:      json.projectId,
            userId:         json.userId,
            payload:        json.payload ?? {},
            sequenceNumber: json.sequenceNumber ?? null,
            timestamp:      json.timestamp ?? new Date().toISOString(),
        });
    }

    /**
     * Convenience factory - automatically generates an operationId.
     *
     * @param {string} type       - one of OperationType
     * @param {string} projectId
     * @param {string} userId
     * @param {object} payload
     * @returns {Operation}
     */
    static create(type, projectId, userId, payload) {
        return new Operation({
            type,
            operationId: crypto.randomUUID(),
            projectId,
            userId,
            payload: payload ?? {},
        });
    }
}


/**
 * Bounded queue of outgoing Operations.
 * Notifies subscribers on every mutation.
 */
export class OperationQueue {

    /**
     * @param {{ maxSize?: number }} options
     */
    constructor({ maxSize = 100 } = {}) {
        this._maxSize   = maxSize;
        this._ops       = new Map();   // operationId -> Operation
        this._order     = [];          // ordered list of operationIds (insertion order)
        this._listeners = new Set();
    }


    // ------------------------------------------------------------------
    // Mutation
    // ------------------------------------------------------------------

    /**
     * Add an operation to the tail of the queue.
     * If the queue is full, the oldest operation is evicted with a warning
     * to prevent unbounded growth.
     *
     * @param {Operation} operation
     */
    enqueue(operation) {
        if (!(operation instanceof Operation)) {
            throw new TypeError('OperationQueue.enqueue: expected an Operation instance.');
        }
        if (this._ops.has(operation.operationId)) return; // idempotent

        // Evict oldest if at capacity
        if (this._order.length >= this._maxSize) {
            const oldest = this._order[0];
            console.warn(`OperationQueue: queue full (${this._maxSize}), evicting oldest operation ${oldest}.`);
            this._ops.delete(oldest);
            this._order.shift();
        }

        this._ops.set(operation.operationId, operation);
        this._order.push(operation.operationId);
        this._notify();
    }

    /**
     * Remove an operation from the queue by its ID.
     *
     * @param {string} operationId
     * @returns {boolean} True if the operation was found and removed.
     */
    dequeue(operationId) {
        if (!this._ops.has(operationId)) return false;
        this._ops.delete(operationId);
        this._order = this._order.filter(id => id !== operationId);
        this._notify();
        return true;
    }

    /**
     * Mark an operation as acknowledged by the server.
     * Replaces the entry with an acknowledged copy but keeps it in the queue
     * until the caller decides to dequeue it.
     *
     * @param {string} operationId
     * @param {number} sequenceNumber
     * @returns {boolean} True if the operation was found.
     */
    acknowledge(operationId, sequenceNumber) {
        const op = this._ops.get(operationId);
        if (!op) return false;
        this._ops.set(operationId, op.acknowledge(sequenceNumber));
        this._notify();
        return true;
    }


    // ------------------------------------------------------------------
    // Read
    // ------------------------------------------------------------------

    /**
     * All operations that have NOT yet been acknowledged.
     * @returns {Operation[]}
     */
    get pending() {
        return this._order
            .map(id => this._ops.get(id))
            .filter(op => !op.isAcknowledged);
    }

    /** Total number of operations (acknowledged + pending). */
    get size() { return this._order.length; }

    /**
     * True if the queue contains an operation with the given ID.
     * @param {string} operationId
     */
    has(operationId) { return this._ops.has(operationId); }

    /**
     * Returns all pending operations whose sequenceNumber is greater than
     * the supplied value (or all pending ops if sequenceNumber is null).
     * Used for re-sending unconfirmed operations after a reconnect.
     *
     * @param {number|null} sequenceNumber
     * @returns {Operation[]}
     */
    getPendingAfter(sequenceNumber) {
        return this.pending.filter(op =>
            sequenceNumber === null || op.sequenceNumber === null || op.sequenceNumber > sequenceNumber
        );
    }


    // ------------------------------------------------------------------
    // Subscription
    // ------------------------------------------------------------------

    /**
     * Subscribe to queue changes.
     * @param {function(): void} callback
     * @returns {function(): void} Unsubscribe function.
     */
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }


    // ------------------------------------------------------------------
    // Utilities
    // ------------------------------------------------------------------

    /** Remove all operations from the queue. */
    clear() {
        this._ops.clear();
        this._order = [];
        this._notify();
    }

    /** Notify all subscribers. */
    _notify() {
        for (const cb of this._listeners) {
            try { cb(); } catch (e) { console.error('OperationQueue subscriber error:', e); }
        }
    }
}
