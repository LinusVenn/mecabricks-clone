/**
 * MechanicalConnectionManager – Verwaltet mechanische Verbindungen (Phase F.5)
 *
 * Unterscheidet zwischen:
 *  - Starren Verbindungen   (rigid):    keine Relativbewegung
 *  - Drehgelenken           (revolute): Rotation um eine Achse
 *  - Schiebegelenken        (prismatic):Translation entlang einer Achse
 *  - Kugelgelenken          (ball):     Rotation um mehrere Achsen
 *  - Zahnradverbindungen    (gear):     gekoppelte Rotation
 *  - Achsverbindungen       (axle):     gemeinsame Rotation
 *
 * WICHTIG: Diese Klasse speichert und verwaltet Verbindungsdefinitionen.
 * Eine vollständige Physiksimulation ist NICHT Teil von Phase F.
 */

// ---------------------------------------------------------------------------
// ID generator (mirrors the pattern used by ConnectionManager)
// ---------------------------------------------------------------------------

function generateMechConnectionId() {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return `mconn-${crypto.randomUUID()}`;
    }
    return `mconn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Mechanical connection type constants
// ---------------------------------------------------------------------------

/**
 * Enumeration of supported mechanical joint types.
 * All values are frozen to prevent accidental mutation.
 *
 * @readonly
 * @enum {string}
 */
export const MECHANICAL_CONNECTION_TYPES = Object.freeze({
    RIGID:     'rigid',
    REVOLUTE:  'revolute',
    PRISMATIC: 'prismatic',
    BALL:      'ball',
    GEAR:      'gear',
    AXLE:      'axle'
});

/** Set of all valid type strings for fast membership testing. */
const VALID_TYPES = new Set(Object.values(MECHANICAL_CONNECTION_TYPES));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check that a value is a finite number.
 * @param {*} v
 * @returns {boolean}
 */
function isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
}

/**
 * Check that an object looks like a 3-D vector {x, y, z}.
 * @param {*} v
 * @returns {boolean}
 */
function isVector3(v) {
    return (
        v !== null &&
        typeof v === 'object' &&
        isFiniteNumber(v.x) &&
        isFiniteNumber(v.y) &&
        isFiniteNumber(v.z)
    );
}

/**
 * Normalize a vector {x, y, z} to unit length.
 * Returns the original object unchanged if its magnitude is already ≈ 1.
 * @param {{x:number, y:number, z:number}} v
 * @returns {{x:number, y:number, z:number}}
 */
function normalizeVec(v) {
    const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (m < 1e-9) return { x: 0, y: 1, z: 0 };
    if (Math.abs(m - 1) < 1e-6) return v;  // already unit length
    return { x: v.x / m, y: v.y / m, z: v.z / m };
}

/**
 * Deep-clone a plain vector object or return null.
 * @param {*} v
 * @returns {{x:number, y:number, z:number}|null}
 */
function cloneVec(v) {
    if (!isVector3(v)) return null;
    return { x: v.x, y: v.y, z: v.z };
}

// ---------------------------------------------------------------------------
// MechanicalConnection
// ---------------------------------------------------------------------------

/**
 * Immutable value object representing a single mechanical connection between
 * two part instances.
 */
export class MechanicalConnection {

    /**
     * @param {object} def
     * @param {string}  [def.id]                  Auto-generated when omitted
     * @param {string}   def.type                 One of MECHANICAL_CONNECTION_TYPES
     * @param {string}   def.partA                Instance ID of part A
     * @param {string}   def.partB                Instance ID of part B
     * @param {string}   [def.connectionPointA]   Connection-point ID on partA
     * @param {string}   [def.connectionPointB]   Connection-point ID on partB
     * @param {{x,y,z}}  [def.anchor]             World-space pivot point
     * @param {{x,y,z}}  [def.axis]               Normalized rotation/translation axis
     * @param {{min:number, max:number}} [def.limits]  Degrees (revolute) or units (prismatic)
     * @param {number}   [def.gearRatio=1.0]       Only for 'gear' type
     */
    constructor(def) {

        if (!def || typeof def !== 'object') {
            throw new TypeError('MechanicalConnection: def must be a non-null object.');
        }

        // ---- id ------------------------------------------------------------
        this._id = typeof def.id === 'string' && def.id.trim().length > 0
            ? def.id.trim()
            : generateMechConnectionId();

        // ---- type ----------------------------------------------------------
        if (!VALID_TYPES.has(def.type)) {
            throw new TypeError(
                `MechanicalConnection: unknown type '${def.type}'. ` +
                `Valid types: ${[...VALID_TYPES].join(', ')}.`
            );
        }
        this._type = def.type;

        // ---- part IDs ------------------------------------------------------
        if (typeof def.partA !== 'string' || def.partA.trim().length === 0) {
            throw new TypeError('MechanicalConnection: partA must be a non-empty string.');
        }
        if (typeof def.partB !== 'string' || def.partB.trim().length === 0) {
            throw new TypeError('MechanicalConnection: partB must be a non-empty string.');
        }
        if (def.partA === def.partB) {
            throw new TypeError('MechanicalConnection: partA and partB must be different instances.');
        }

        this._partA = def.partA.trim();
        this._partB = def.partB.trim();

        // ---- optional connection-point IDs ---------------------------------
        this._connectionPointA =
            typeof def.connectionPointA === 'string' ? def.connectionPointA : null;
        this._connectionPointB =
            typeof def.connectionPointB === 'string' ? def.connectionPointB : null;

        // ---- anchor (world-space pivot) ------------------------------------
        this._anchor = isVector3(def.anchor) ? cloneVec(def.anchor) : null;

        // ---- axis (must be unit-length for revolute / prismatic / axle) ----
        if (def.axis !== undefined && def.axis !== null) {
            if (!isVector3(def.axis)) {
                throw new TypeError('MechanicalConnection: axis must be a {x,y,z} vector.');
            }
            this._axis = normalizeVec(cloneVec(def.axis));
        } else {
            this._axis = null;
        }

        // ---- limits --------------------------------------------------------
        if (def.limits !== undefined && def.limits !== null) {
            const { min, max } = def.limits;
            if (!isFiniteNumber(min) || !isFiniteNumber(max)) {
                throw new TypeError('MechanicalConnection: limits.min and limits.max must be finite numbers.');
            }
            if (min > max) {
                throw new RangeError('MechanicalConnection: limits.min must be ≤ limits.max.');
            }
            this._limits = Object.freeze({ min, max });
        } else {
            this._limits = null;
        }

        // ---- gearRatio (gear type only) ------------------------------------
        if (def.type === MECHANICAL_CONNECTION_TYPES.GEAR) {
            const gr = def.gearRatio;
            this._gearRatio = (gr !== undefined && isFiniteNumber(gr)) ? gr : 1.0;
        } else {
            this._gearRatio = 1.0;
        }

        // Seal the instance so no new properties can be added accidentally
        Object.seal(this);
    }

    // -------------------------------------------------------------------------
    // Immutable getters
    // -------------------------------------------------------------------------

    /** @returns {string} */
    get id()               { return this._id; }

    /** @returns {string} */
    get type()             { return this._type; }

    /** @returns {string} */
    get partA()            { return this._partA; }

    /** @returns {string} */
    get partB()            { return this._partB; }

    /** @returns {string|null} */
    get connectionPointA() { return this._connectionPointA; }

    /** @returns {string|null} */
    get connectionPointB() { return this._connectionPointB; }

    /** @returns {{x:number, y:number, z:number}|null} */
    get anchor()           { return this._anchor ? { ...this._anchor } : null; }

    /** @returns {{x:number, y:number, z:number}|null} */
    get axis()             { return this._axis ? { ...this._axis } : null; }

    /** @returns {{min:number, max:number}|null} */
    get limits()           { return this._limits ? { ...this._limits } : null; }

    /** @returns {number} */
    get gearRatio()        { return this._gearRatio; }

    // -------------------------------------------------------------------------
    // isMovable
    // -------------------------------------------------------------------------

    /**
     * Returns false for rigid connections; true for all other joint types.
     * @returns {boolean}
     */
    isMovable() {
        return this._type !== MECHANICAL_CONNECTION_TYPES.RIGID;
    }

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    /**
     * Semantic validation of the connection definition.
     *
     * Constructor-level type/shape checks always run at construction time;
     * this method adds domain-level checks that require context.
     *
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate() {
        const errors = [];

        // Revolute, prismatic and axle joints must define an axis
        const AXIS_REQUIRED_TYPES = new Set([
            MECHANICAL_CONNECTION_TYPES.REVOLUTE,
            MECHANICAL_CONNECTION_TYPES.PRISMATIC,
            MECHANICAL_CONNECTION_TYPES.AXLE
        ]);

        if (AXIS_REQUIRED_TYPES.has(this._type) && !this._axis) {
            errors.push(
                `Type '${this._type}' requires an 'axis' vector but none was provided.`
            );
        }

        // Limits only make sense for revolute / prismatic
        const LIMITS_MEANINGFUL = new Set([
            MECHANICAL_CONNECTION_TYPES.REVOLUTE,
            MECHANICAL_CONNECTION_TYPES.PRISMATIC
        ]);

        if (this._limits && !LIMITS_MEANINGFUL.has(this._type)) {
            errors.push(
                `'limits' is defined but has no physical meaning for type '${this._type}'. ` +
                `Remove it or use 'revolute' / 'prismatic'.`
            );
        }

        // gearRatio should be non-zero for gear connections
        if (this._type === MECHANICAL_CONNECTION_TYPES.GEAR && this._gearRatio === 0) {
            errors.push(`gearRatio must not be zero for type 'gear'.`);
        }

        // An anchor is recommended for revolute joints but not strictly required
        if (
            this._type === MECHANICAL_CONNECTION_TYPES.REVOLUTE &&
            !this._anchor
        ) {
            errors.push(
                `Type 'revolute' should define an 'anchor' (world-space pivot). ` +
                `Proceeding without one may produce unexpected rotation behavior.`
            );
        }

        return {
            valid:  errors.length === 0,
            errors: [...errors]
        };
    }

    // -------------------------------------------------------------------------
    // Serialization
    // -------------------------------------------------------------------------

    /**
     * Serialize to a plain data object suitable for JSON.stringify / storage.
     * @returns {object}
     */
    toData() {
        return {
            id:               this._id,
            type:             this._type,
            partA:            this._partA,
            partB:            this._partB,
            connectionPointA: this._connectionPointA,
            connectionPointB: this._connectionPointB,
            anchor:           this._anchor ? { ...this._anchor } : null,
            axis:             this._axis   ? { ...this._axis   } : null,
            limits:           this._limits ? { ...this._limits } : null,
            gearRatio:        this._gearRatio
        };
    }

    /**
     * Reconstruct a MechanicalConnection from serialized data.
     * @param {object} data
     * @returns {MechanicalConnection}
     */
    static fromData(data) {
        if (!data || typeof data !== 'object') {
            throw new TypeError('MechanicalConnection.fromData: data must be a non-null object.');
        }
        return new MechanicalConnection(data);
    }
}

// ---------------------------------------------------------------------------
// MechanicalConnectionManager
// ---------------------------------------------------------------------------

/** Singleton instance reference. */
let _instance = null;

/**
 * Central store for all mechanical connections in the current scene.
 *
 * Lifecycle is identical to other Phase-F managers:
 *  - Use `MechanicalConnectionManager.instance()` for the singleton.
 *  - Use `MechanicalConnectionManager.resetInstance()` in tests.
 */
export class MechanicalConnectionManager {

    constructor() {
        /**
         * Internal map: connection id → MechanicalConnection
         * @type {Map<string, MechanicalConnection>}
         */
        this._connections = new Map();
    }

    // -------------------------------------------------------------------------
    // Add / get / remove
    // -------------------------------------------------------------------------

    /**
     * Create and register a new mechanical connection.
     *
     * @param {object} def - Connection definition (see MechanicalConnection constructor)
     * @returns {MechanicalConnection}
     * @throws {TypeError | RangeError} if the definition is invalid
     */
    addConnection(def) {
        // MechanicalConnection constructor performs all shape validation
        const conn = new MechanicalConnection(def);

        // Semantic validation
        const { valid, errors } = conn.validate();
        if (!valid) {
            // Treat domain errors as warnings (non-fatal) — log but do not throw
            // so that partial / incomplete connections from older saves still load.
            // A calling layer may inspect the validation result via conn.validate()
            // before using isMovable().
            console.warn(
                `MechanicalConnectionManager: connection '${conn.id}' has warnings:`,
                errors
            );
        }

        if (this._connections.has(conn.id)) {
            throw new Error(
                `MechanicalConnectionManager: a connection with id '${conn.id}' already exists.`
            );
        }

        this._connections.set(conn.id, conn);
        return conn;
    }

    /**
     * Retrieve a connection by id.
     *
     * @param {string} id
     * @returns {MechanicalConnection|null}
     */
    getConnection(id) {
        return this._connections.get(id) ?? null;
    }

    /**
     * Return all connections that involve the given part instance
     * (as either partA or partB).
     *
     * @param {string} instanceId
     * @returns {MechanicalConnection[]}
     */
    getConnectionsForPart(instanceId) {
        const result = [];
        for (const conn of this._connections.values()) {
            if (conn.partA === instanceId || conn.partB === instanceId) {
                result.push(conn);
            }
        }
        return result;
    }

    /**
     * Return a snapshot array of all registered connections.
     *
     * @returns {MechanicalConnection[]}
     */
    getAllConnections() {
        return [...this._connections.values()];
    }

    /**
     * Remove a connection by id.
     *
     * @param {string} id
     * @returns {boolean} true if the connection existed and was removed
     */
    removeConnection(id) {
        return this._connections.delete(id);
    }

    /**
     * Remove all connections that involve the given part instance.
     *
     * @param {string} instanceId
     * @returns {number} count of connections removed
     */
    removeConnectionsForPart(instanceId) {
        let count = 0;
        for (const [id, conn] of this._connections) {
            if (conn.partA === instanceId || conn.partB === instanceId) {
                this._connections.delete(id);
                count++;
            }
        }
        return count;
    }

    /**
     * Return the total number of registered connections.
     *
     * @returns {number}
     */
    getCount() {
        return this._connections.size;
    }

    /**
     * Remove all connections.
     */
    clear() {
        this._connections.clear();
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    /**
     * Check whether at least one connection exists between two part instances
     * (direction-independent).
     *
     * @param {string} instanceIdA
     * @param {string} instanceIdB
     * @returns {boolean}
     */
    hasConnectionBetween(instanceIdA, instanceIdB) {
        for (const conn of this._connections.values()) {
            if (
                (conn.partA === instanceIdA && conn.partB === instanceIdB) ||
                (conn.partA === instanceIdB && conn.partB === instanceIdA)
            ) {
                return true;
            }
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Serialization
    // -------------------------------------------------------------------------

    /**
     * Serialize all connections to a plain data object.
     *
     * @returns {{ mechanicalConnections: object[] }}
     */
    toData() {
        return {
            mechanicalConnections: [...this._connections.values()].map(c => c.toData())
        };
    }

    /**
     * Load connections from persisted data.
     *
     * Invalid or orphaned entries are skipped and reported rather than throwing,
     * so a partially-corrupted save file still loads as much as possible.
     *
     * @param {object}      data             Serialized data (from toData())
     * @param {Set<string>} knownInstanceIds Set of valid part instance IDs
     * @returns {{ loaded: number, skipped: number, errors: Error[] }}
     */
    loadFromData(data, knownInstanceIds) {

        let loaded  = 0;
        let skipped = 0;
        const errors = [];

        if (!data || !Array.isArray(data.mechanicalConnections)) {
            errors.push(new TypeError(
                'loadFromData: data.mechanicalConnections must be an array.'
            ));
            return { loaded, skipped, errors };
        }

        const validIds = knownInstanceIds instanceof Set
            ? knownInstanceIds
            : new Set();

        for (const raw of data.mechanicalConnections) {

            try {

                // Validate that referenced parts exist
                if (raw.partA && validIds.size > 0 && !validIds.has(raw.partA)) {
                    throw new Error(
                        `Referenced partA '${raw.partA}' is not a known instance.`
                    );
                }
                if (raw.partB && validIds.size > 0 && !validIds.has(raw.partB)) {
                    throw new Error(
                        `Referenced partB '${raw.partB}' is not a known instance.`
                    );
                }

                // Skip duplicates silently (id already registered)
                if (raw.id && this._connections.has(raw.id)) {
                    skipped++;
                    continue;
                }

                const conn = MechanicalConnection.fromData(raw);
                this._connections.set(conn.id, conn);
                loaded++;

            } catch (err) {
                skipped++;
                errors.push(err instanceof Error ? err : new Error(String(err)));
            }
        }

        return { loaded, skipped, errors };
    }

    // -------------------------------------------------------------------------
    // Singleton
    // -------------------------------------------------------------------------

    /**
     * Return (or create) the module-level singleton instance.
     *
     * @returns {MechanicalConnectionManager}
     */
    static instance() {
        if (!_instance) {
            _instance = new MechanicalConnectionManager();
        }
        return _instance;
    }

    /**
     * Destroy the singleton.  Intended for use in tests only.
     */
    static resetInstance() {
        _instance = null;
    }
}
