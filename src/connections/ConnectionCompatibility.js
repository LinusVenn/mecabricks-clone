/**
 * ConnectionCompatibility – Prüft Kompatibilität mechanischer Verbindungen (Phase F.3)
 *
 * Beantwortet die Frage: Dürfen Verbindungspunkt A und B verbunden werden?
 *
 * Prüft:
 *  1. Typkompatibilität (z.B. stud ↔ anti-stud)
 *  2. Dimensionskompatibilität (z.B. gleicher Durchmesser für Technic-Löcher)
 *  3. Ausrichtungskompatibilität (Achsen müssen fluchten oder komplementär sein)
 *  4. Eigenschaftskompatibilität (connectionMode, accepts-Liste)
 */

import { CONNECTION_TYPES } from './ConnectionTypes.js';

// ---------------------------------------------------------------------------
// Compatibility matrix
//
// Structure:  typeA -> typeB -> 'full' | 'partial' | 'none'
//
// Only the canonical direction is stored; the lookup function handles both
// directions automatically so the table stays compact and non-redundant.
// ---------------------------------------------------------------------------

/**
 * Plain-object compatibility matrix exported for external reference.
 *
 * Keys are connection-type strings.  Each value is an object mapping a partner
 * type to 'full', 'partial', or 'none'.  Unlisted pairs default to 'none'.
 *
 * @type {Record<string, Record<string, 'full'|'partial'|'none'>>}
 */
export const COMPATIBILITY_MATRIX = Object.freeze({

    // ---- stud family -------------------------------------------------------
    'stud': {
        'anti-stud':      'full',
        'stud-to-bottom': 'full'    // legacy flat-top-bottom connection
    },

    'anti-stud': {
        'stud':           'full',
        'stud-to-bottom': 'full'
    },

    'stud-to-bottom': {
        'stud':           'full',
        'anti-stud':      'full',
        'stud-to-bottom': 'full'
    },

    // ---- Technic / axle family ---------------------------------------------
    'technic-hole': {
        'technic-hole': 'full',     // pin fits both ends
        'axle-hole':    'partial',  // axle fits; pin may not seat fully
        'pin-hole':     'partial'   // friction pin can bridge
    },

    'axle-hole': {
        'axle-hole':    'full',
        'technic-hole': 'partial'
    },

    'pin-hole': {
        'pin-hole':     'full',
        'technic-hole': 'partial'
    },

    // ---- clip / bar family -------------------------------------------------
    'clip': {
        'bar': 'full'
    },

    'bar': {
        'clip': 'full'
    },

    // ---- hinge family ------------------------------------------------------
    'hinge-male': {
        'hinge-female': 'full'
    },

    'hinge-female': {
        'hinge-male': 'full'
    },

    // ---- ball / socket family ----------------------------------------------
    'ball': {
        'ball-socket': 'full'
    },

    'ball-socket': {
        'ball': 'full'
    },

    // ---- gear family -------------------------------------------------------
    'gear': {
        'gear': 'partial'           // depends on tooth count; always partial
    }
});

// ---------------------------------------------------------------------------
// Default tolerances
// ---------------------------------------------------------------------------

const DEFAULT_ANGLE_TOLERANCE_DEG = 5;    // degrees
const DEFAULT_DISTANCE_TOLERANCE  = 0.1;  // LDU (or world units)

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
function toRad(deg) {
    return (deg * Math.PI) / 180;
}

/**
 * Compute the magnitude of a 3-component vector object.
 * @param {{x:number, y:number, z:number}} v
 * @returns {number}
 */
function magnitude(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Dot product of two 3-component vector objects.
 * @param {{x:number, y:number, z:number}} a
 * @param {{x:number, y:number, z:number}} b
 * @returns {number}
 */
function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Normalize a 3-component vector object.
 * Returns {x:0, y:1, z:0} for the zero vector so callers always get a safe result.
 * @param {{x:number, y:number, z:number}} v
 * @returns {{x:number, y:number, z:number}}
 */
function normalize(v) {
    const m = magnitude(v);
    if (m < 1e-9) return { x: 0, y: 1, z: 0 };
    return { x: v.x / m, y: v.y / m, z: v.z / m };
}

// ---------------------------------------------------------------------------
// ConnectionCompatibility
// ---------------------------------------------------------------------------

export class ConnectionCompatibility {

    /**
     * @param {object} [options]
     * @param {object} [options.tolerances]
     * @param {number} [options.tolerances.angle=5]      Angular tolerance in degrees
     * @param {number} [options.tolerances.distance=0.1] Distance tolerance in world units
     */
    constructor(options = {}) {

        const tol = (options && options.tolerances) ? options.tolerances : {};

        /** @type {{ angle: number, distance: number }} */
        this.tolerances = Object.freeze({
            angle:    typeof tol.angle    === 'number' ? tol.angle    : DEFAULT_ANGLE_TOLERANCE_DEG,
            distance: typeof tol.distance === 'number' ? tol.distance : DEFAULT_DISTANCE_TOLERANCE
        });
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Full compatibility check between two ConnectionPoint instances.
     *
     * Evaluates type, direction and (where available) dimension / property
     * compatibility and returns a structured result.
     *
     * @param {object} pointA - ConnectionPoint instance
     * @param {object} pointB - ConnectionPoint instance
     * @returns {{ compatible: boolean, confidence: 'full'|'partial'|'none', reason: string }}
     */
    check(pointA, pointB) {

        // --- guard: both points must be provided ----------------------------
        if (!pointA || !pointB) {
            return {
                compatible: false,
                confidence: 'none',
                reason:     'One or both connection points are null/undefined.'
            };
        }

        const typeA = pointA.type ?? pointA.connectionType;
        const typeB = pointB.type ?? pointB.connectionType;

        // --- 1. Type compatibility ------------------------------------------
        const typePair = this.isAllowedPair(typeA, typeB);

        if (typePair === 'none') {
            return {
                compatible: false,
                confidence: 'none',
                reason:     `Type mismatch: '${typeA}' is not compatible with '${typeB}'.`
            };
        }

        // --- 2. Direction / axis compatibility -------------------------------
        const dirA = pointA.direction ?? pointA.normal;
        const dirB = pointB.direction ?? pointB.normal;

        if (dirA && dirB) {
            const dirOk = this.checkDirections(dirA, dirB, this.tolerances.angle);
            if (!dirOk) {
                return {
                    compatible: false,
                    confidence: 'none',
                    reason:
                        `Direction mismatch: connection axes are not anti-parallel ` +
                        `within ${this.tolerances.angle}°.`
                };
            }
        }

        // --- 3. Dimension compatibility (optional) ---------------------------
        const dimA = pointA.diameter ?? pointA.size ?? pointA.dimensions;
        const dimB = pointB.diameter ?? pointB.size ?? pointB.dimensions;

        if (dimA !== undefined && dimB !== undefined) {
            const dimOk = this._checkDimensions(dimA, dimB, typeA, typeB);
            if (!dimOk) {
                return {
                    compatible: false,
                    confidence: 'none',
                    reason:
                        `Dimension mismatch: '${typeA}' (size ${dimA}) cannot ` +
                        `connect to '${typeB}' (size ${dimB}).`
                };
            }
        }

        // --- 4. Property / accepts-list compatibility ------------------------
        const propResult = this._checkProperties(pointA, pointB, typeA, typeB);
        if (!propResult.ok) {
            return {
                compatible: false,
                confidence: 'none',
                reason:     propResult.reason
            };
        }

        // --- 5. Resolve confidence ------------------------------------------
        // If either the type pair or any property check yielded 'partial',
        // return partial even when all checks passed.
        const confidence =
            typePair === 'partial' || propResult.confidence === 'partial'
                ? 'partial'
                : 'full';

        return {
            compatible: true,
            confidence,
            reason:
                confidence === 'full'
                    ? `'${typeA}' and '${typeB}' are fully compatible.`
                    : `'${typeA}' and '${typeB}' are conditionally compatible.`
        };
    }

    /**
     * Pure type-level compatibility check (no geometry).
     *
     * @param {string} typeA
     * @param {string} typeB
     * @returns {boolean}
     */
    checkTypes(typeA, typeB) {
        return this.isAllowedPair(typeA, typeB) !== 'none';
    }

    /**
     * Check whether two direction vectors are anti-parallel within the given
     * angular tolerance.
     *
     * For a stud connection, the stud points upward (+Y) and the anti-stud
     * faces downward (−Y).  Compatible directions therefore have a dot product
     * of ≈ −1 (anti-parallel).
     *
     * @param {{x:number, y:number, z:number}} dirA
     * @param {{x:number, y:number, z:number}} dirB
     * @param {number} [toleranceDeg] - Angular tolerance in degrees (defaults to instance tolerance)
     * @returns {boolean}
     */
    checkDirections(dirA, dirB, toleranceDeg) {
        const tol = typeof toleranceDeg === 'number'
            ? toleranceDeg
            : this.tolerances.angle;

        const nA = normalize(dirA);
        const nB = normalize(dirB);

        // dot product of two perfectly anti-parallel unit vectors == -1
        const d = dot(nA, nB);

        // threshold: cos(180° - tol) — dot must be ≤ this value
        const threshold = Math.cos(Math.PI - toRad(tol));

        return d <= threshold;
    }

    /**
     * Return all connection types that are compatible with the given type.
     *
     * @param {string} type
     * @returns {string[]}
     */
    getCompatibleTypes(type) {
        const result = new Set();

        // From the matrix row for `type`
        const row = COMPATIBILITY_MATRIX[type];
        if (row) {
            for (const [partner, level] of Object.entries(row)) {
                if (level !== 'none') result.add(partner);
            }
        }

        // Reverse scan: any row that lists `type` as a compatible partner
        for (const [rowType, partners] of Object.entries(COMPATIBILITY_MATRIX)) {
            if (rowType === type) continue;
            if (partners[type] && partners[type] !== 'none') {
                result.add(rowType);
            }
        }

        return [...result];
    }

    /**
     * Determine the compatibility level between two types.
     *
     * @param {string} typeA
     * @param {string} typeB
     * @returns {'full'|'partial'|'none'}
     */
    isAllowedPair(typeA, typeB) {

        if (typeof typeA !== 'string' || typeof typeB !== 'string') {
            return 'none';
        }

        // Direct lookup
        const direct = COMPATIBILITY_MATRIX[typeA] && COMPATIBILITY_MATRIX[typeA][typeB];
        if (direct) return direct;

        // Reverse lookup (matrix is not fully mirrored for compactness)
        const reverse = COMPATIBILITY_MATRIX[typeB] && COMPATIBILITY_MATRIX[typeB][typeA];
        if (reverse) return reverse;

        return 'none';
    }

    // -------------------------------------------------------------------------
    // Static readonly accessor — Map<type, Map<partner, level>>
    // -------------------------------------------------------------------------

    /**
     * The compatibility matrix as a lazily-constructed read-only Map for
     * programmatic iteration.
     *
     * @returns {Map<string, Map<string, 'full'|'partial'|'none'>>}
     */
    static get COMPATIBILITY_MATRIX() {
        if (!ConnectionCompatibility._matrixCache) {
            const m = new Map();
            for (const [typeKey, partners] of Object.entries(COMPATIBILITY_MATRIX)) {
                const inner = new Map();
                for (const [partnerKey, level] of Object.entries(partners)) {
                    inner.set(partnerKey, level);
                }
                m.set(typeKey, inner);
            }
            // Freeze only the outer Map reference; inner Maps are already built
            ConnectionCompatibility._matrixCache = m;
        }
        return ConnectionCompatibility._matrixCache;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Check dimensional compatibility.
     *
     * For numeric diameters / sizes the two values must match within the
     * distance tolerance.  Object dimensions are compared field-by-field.
     * String dimensions must match exactly.
     *
     * @param {*} dimA
     * @param {*} dimB
     * @param {string} _typeA  (reserved for future per-type rules)
     * @param {string} _typeB
     * @returns {boolean}
     */
    _checkDimensions(dimA, dimB, _typeA, _typeB) {
        if (typeof dimA === 'number' && typeof dimB === 'number') {
            return Math.abs(dimA - dimB) <= this.tolerances.distance;
        }

        // Object dimensions: compare each numeric field
        if (
            typeof dimA === 'object' && dimA !== null &&
            typeof dimB === 'object' && dimB !== null
        ) {
            const keysA = Object.keys(dimA);
            const keysB = Object.keys(dimB);
            if (keysA.length !== keysB.length) return false;
            return keysA.every(
                k =>
                    k in dimB &&
                    typeof dimA[k] === 'number' &&
                    typeof dimB[k] === 'number' &&
                    Math.abs(dimA[k] - dimB[k]) <= this.tolerances.distance
            );
        }

        // Fallback: strict equality (strings, symbols, …)
        return dimA === dimB;
    }

    /**
     * Check property / accepts-list compatibility.
     *
     * A ConnectionPoint may declare:
     *  - `accepts`        {string[]}  explicit allow-list of partner types
     *  - `connectionMode` {string}    e.g. 'male'/'female' or 'push'/'pull'
     *
     * @param {object} pointA
     * @param {object} pointB
     * @param {string} typeA
     * @param {string} typeB
     * @returns {{ ok: boolean, confidence: 'full'|'partial', reason: string }}
     */
    _checkProperties(pointA, pointB, typeA, typeB) {

        // --- accepts list check ---------------------------------------------
        const acceptsA = pointA.accepts;
        const acceptsB = pointB.accepts;

        if (Array.isArray(acceptsA) && acceptsA.length > 0) {
            if (!acceptsA.includes(typeB)) {
                return {
                    ok:         false,
                    confidence: 'none',
                    reason:     `Point A does not accept type '${typeB}' (accepts: ${acceptsA.join(', ')}).`
                };
            }
        }

        if (Array.isArray(acceptsB) && acceptsB.length > 0) {
            if (!acceptsB.includes(typeA)) {
                return {
                    ok:         false,
                    confidence: 'none',
                    reason:     `Point B does not accept type '${typeA}' (accepts: ${acceptsB.join(', ')}).`
                };
            }
        }

        // --- connectionMode check -------------------------------------------
        // Modes that must be complementary pairs
        const COMPLEMENTARY = {
            male:   'female',
            female: 'male',
            push:   'pull',
            pull:   'push',
            in:     'out',
            out:    'in'
        };

        const modeA = pointA.connectionMode;
        const modeB = pointB.connectionMode;

        if (modeA && modeB) {
            const expected = COMPLEMENTARY[modeA];
            if (expected !== undefined && modeB !== expected) {
                return {
                    ok:         false,
                    confidence: 'none',
                    reason:
                        `Connection mode mismatch: '${modeA}' is not complementary to '${modeB}'.`
                };
            }
        }

        // --- gear pair: always partial confidence ---------------------------
        if (typeA === 'gear' && typeB === 'gear') {
            return { ok: true, confidence: 'partial', reason: '' };
        }

        return { ok: true, confidence: 'full', reason: '' };
    }
}

/** @type {Map<string, Map<string, 'full'|'partial'|'none'>>|undefined} */
ConnectionCompatibility._matrixCache = undefined;
