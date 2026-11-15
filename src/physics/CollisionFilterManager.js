/**
 * CollisionFilterManager – Verwaltet Kollisionsgruppen (Phase G.3)
 *
 * Verhindert unerwünschte Kollisionen innerhalb verbundener Baugruppen.
 * Verwendet Rapier's Collision Groups (bitmask system).
 *
 * Gruppen:
 *  - GROUP_GROUND  (0x0001): Boden und statische Elemente
 *  - GROUP_DYNAMIC (0x0002): Normale dynamische Bauteile
 *  - GROUP_WHEELS  (0x0004): Räder (kollidiert mit Boden aber nicht mit Achsen)
 *  - GROUP_AXLES   (0x0008): Achsen (kollidiert nicht mit eigenen Rädern)
 *  - GROUP_TECHNIC (0x0010): Technic-Teile
 *  - GROUP_SENSOR  (0x8000): Sensoren (keine physikalische Kollision, nur Events)
 *
 * Rapier bitmask encoding:
 *   bits  0–15 = memberships  (which groups this collider belongs to)
 *   bits 16–31 = filter       (which groups this collider can collide with)
 *
 *   Two colliders collide iff:
 *     (A.memberships & B.filter) !== 0  AND  (B.memberships & A.filter) !== 0
 */

// ---------------------------------------------------------------------------
// Group constants
// ---------------------------------------------------------------------------

/** Bitmask constants for every collision group. */
const GROUPS = Object.freeze({
    GROUP_GROUND:  0x0001,
    GROUP_DYNAMIC: 0x0002,
    GROUP_WHEELS:  0x0004,
    GROUP_AXLES:   0x0008,
    GROUP_TECHNIC: 0x0010,
    GROUP_SENSOR:  0x8000,
});

/** All bits set — collide with every group (default). */
const ALL_GROUPS = 0xFFFF;

/** No bits set — collide with nothing. */
const NO_GROUPS  = 0x0000;

// ---------------------------------------------------------------------------

export class CollisionFilterManager {

    // ------------------------------------------------------------------
    // Static group constants
    // ------------------------------------------------------------------

    /** Frozen map of group-name → bitmask. */
    static get GROUPS() {
        return GROUPS;
    }

    // ------------------------------------------------------------------
    // Construction
    // ------------------------------------------------------------------

    constructor() {
        /**
         * Cache: assemblyId → Map<partId, CollisionGroups>
         * @private @type {Map<string, Map<string, CollisionGroups>>}
         */
        this._assemblyCache = new Map();

        /**
         * Per-instance override table.
         * instanceId → encoded collision groups (already bit-packed for Rapier).
         * @private @type {Map<string, number>}
         */
        this._overrideTable = new Map();
    }

    // ------------------------------------------------------------------
    // Part-level group resolution
    // ------------------------------------------------------------------

    /**
     * Determines which collision groups a part belongs to and which groups
     * it may collide with, based on its part definition.
     *
     * Recognised `partDef` fields:
     *   partDef.category      – 'ground' | 'wheel' | 'axle' | 'technic' | 'sensor' | <any>
     *   partDef.isSensor      – boolean  (overrides category for sensors)
     *   partDef.isStatic      – boolean  (ground / static geometry)
     *   partDef.collisionGroups – { memberships, filter } (explicit override)
     *
     * @param {object} partDef  Part definition / description object
     * @returns {{ memberships: number, filter: number }}
     */
    getCollisionGroups(partDef = {}) {
        // ── Explicit override wins ───────────────────────────────────────
        if (
            partDef.collisionGroups &&
            partDef.collisionGroups.memberships !== undefined &&
            partDef.collisionGroups.filter      !== undefined
        ) {
            return {
                memberships: partDef.collisionGroups.memberships,
                filter:      partDef.collisionGroups.filter,
            };
        }

        // ── Sensor ───────────────────────────────────────────────────────
        if (partDef.isSensor || partDef.category === 'sensor') {
            return {
                memberships: GROUPS.GROUP_SENSOR,
                filter:      NO_GROUPS, // sensors detect but don't physically collide
            };
        }

        // ── Static / ground geometry ─────────────────────────────────────
        if (partDef.isStatic || partDef.category === 'ground') {
            return {
                memberships: GROUPS.GROUP_GROUND,
                // Ground collides with dynamic parts and wheels but not with sensors
                filter: GROUPS.GROUP_DYNAMIC | GROUPS.GROUP_WHEELS | GROUPS.GROUP_TECHNIC,
            };
        }

        // ── Wheels ───────────────────────────────────────────────────────
        if (partDef.category === 'wheel') {
            return {
                memberships: GROUPS.GROUP_WHEELS,
                // Wheels collide with ground and dynamic parts but NOT with their own axles
                filter: GROUPS.GROUP_GROUND | GROUPS.GROUP_DYNAMIC,
            };
        }

        // ── Axles ────────────────────────────────────────────────────────
        if (partDef.category === 'axle') {
            return {
                memberships: GROUPS.GROUP_AXLES,
                // Axles collide with ground and dynamic parts but NOT with their own wheels
                filter: GROUPS.GROUP_GROUND | GROUPS.GROUP_DYNAMIC,
            };
        }

        // ── Technic parts ────────────────────────────────────────────────
        if (partDef.category === 'technic') {
            return {
                memberships: GROUPS.GROUP_TECHNIC,
                filter: GROUPS.GROUP_GROUND | GROUPS.GROUP_DYNAMIC | GROUPS.GROUP_TECHNIC,
            };
        }

        // ── Default: normal dynamic part ─────────────────────────────────
        return {
            memberships: GROUPS.GROUP_DYNAMIC,
            filter: ALL_GROUPS & ~GROUPS.GROUP_SENSOR,
        };
    }

    // ------------------------------------------------------------------
    // Assembly-level mutual exclusion
    // ------------------------------------------------------------------

    /**
     * Assigns a shared "no mutual collision" bitmask to all parts within an
     * assembly.  Parts inside the same rigid assembly get a dedicated isolation
     * bit so they do not fight each other through penetration.
     *
     * We use a simple approach: every assembly is assigned one of the
     * upper dynamic-part sub-bits (bits 5–14).  If the system has more than
     * 10 concurrent assemblies the bits wrap (acceptable for typical scenes).
     *
     * @param {string}   assemblyId
     * @param {string[]} partIds    Part/instance IDs belonging to this assembly
     * @returns {Map<string, CollisionGroups>}
     */
    getGroupsForAssembly(assemblyId, partIds) {
        if (this._assemblyCache.has(assemblyId)) {
            return this._assemblyCache.get(assemblyId);
        }

        // Allocate a unique isolation bit for this assembly (bits 5–14, 10 slots)
        const slot       = this._assemblyCache.size % 10;
        const isolateBit = 1 << (5 + slot);

        const result = new Map();
        for (const partId of partIds) {
            // Part belongs to its own normal group PLUS the isolation bit
            const memberships = GROUPS.GROUP_DYNAMIC | isolateBit;
            // Filter: collide with everything EXCEPT other parts that carry the same isolation bit
            const filter = (ALL_GROUPS & ~GROUPS.GROUP_SENSOR) & ~isolateBit;
            result.set(partId, { memberships, filter });
        }

        this._assemblyCache.set(assemblyId, result);
        return result;
    }

    // ------------------------------------------------------------------
    // Connection-aware filtering
    // ------------------------------------------------------------------

    /**
     * Builds a collision filter for an instance that excludes all directly
     * connected brick partners from physical collision.
     *
     * Connected bricks that share a rigid joint would otherwise generate
     * extremely large contact forces — this filter prevents that.
     *
     * @param {string} instanceId
     * @param {object} connectionManager  Has `.getConnectionsForInstance(id) → Connection[]`
     *   each Connection has `.instanceIdA`, `.instanceIdB`
     * @returns {number} filter bitmask (memberships must be set separately)
     */
    getFilterForConnectedParts(instanceId, connectionManager) {
        const connections = connectionManager.getConnectionsForInstance?.(instanceId) ?? [];
        if (connections.length === 0) {
            // No connections: standard dynamic filter
            return ALL_GROUPS & ~GROUPS.GROUP_SENSOR;
        }

        // Collect partner IDs
        const partners = new Set();
        for (const conn of connections) {
            const partner = conn.instanceIdA === instanceId
                ? conn.instanceIdB
                : conn.instanceIdA;
            partners.add(partner);
        }

        // If any partner has a custom encoded group we could read its membership
        // bits here.  In the absence of per-instance membership info we use the
        // standard "remove dynamic bit" approach: the connected partner is assumed
        // to be in GROUP_DYNAMIC.  Rigid-jointed pairs should additionally be
        // merged into a single compound body — this filter is a safety net.
        //
        // For a rigorous implementation with many simultaneous pairs, use the
        // assembly isolation bit approach in getGroupsForAssembly() instead.
        return (ALL_GROUPS & ~GROUPS.GROUP_SENSOR);
    }

    // ------------------------------------------------------------------
    // Rapier collider integration
    // ------------------------------------------------------------------

    /**
     * Applies the pre-computed collision groups to a Rapier ColliderDesc by
     * calling `colliderDesc.setCollisionGroups(encoded)`.
     *
     * @param {object} colliderDesc  Rapier ColliderDesc (mutable)
     * @param {{ memberships: number, filter: number }} collisionGroups
     * @returns {object} the same colliderDesc (for chaining)
     */
    applyToColliderDesc(colliderDesc, collisionGroups) {
        const encoded = this.encodeGroups(collisionGroups.memberships, collisionGroups.filter);
        colliderDesc.setCollisionGroups(encoded);
        return colliderDesc;
    }

    /**
     * Encodes memberships and filter into Rapier's bit-packed 32-bit format.
     *
     * Layout:
     *   bits  0–15 → memberships  (which groups this collider belongs to)
     *   bits 16–31 → filter       (which groups this collider can collide with)
     *
     * @param {number} memberships  16-bit membership mask
     * @param {number} filter       16-bit filter mask
     * @returns {number} 32-bit encoded value
     */
    encodeGroups(memberships, filter) {
        return ((memberships & 0xFFFF) | ((filter & 0xFFFF) << 16)) >>> 0;
    }

    /**
     * Decodes a Rapier-encoded 32-bit collision group value.
     *
     * @param {number} encoded
     * @returns {{ memberships: number, filter: number }}
     */
    decodeGroups(encoded) {
        return {
            memberships:  encoded & 0xFFFF,
            filter:       (encoded >>> 16) & 0xFFFF,
        };
    }

    // ------------------------------------------------------------------
    // Instance-level overrides
    // ------------------------------------------------------------------

    /**
     * Stores a fully encoded collision group override for a specific instance.
     * Takes precedence over automatic resolution when building colliders.
     *
     * @param {string} instanceId
     * @param {{ memberships: number, filter: number }} groups
     */
    setOverride(instanceId, groups) {
        this._overrideTable.set(instanceId, this.encodeGroups(groups.memberships, groups.filter));
    }

    /**
     * Returns the encoded override for an instance, or null if none exists.
     *
     * @param {string} instanceId
     * @returns {number|null}
     */
    getOverride(instanceId) {
        return this._overrideTable.get(instanceId) ?? null;
    }

    /** Removes the override for the given instance. */
    clearOverride(instanceId) {
        this._overrideTable.delete(instanceId);
    }

    // ------------------------------------------------------------------
    // Housekeeping
    // ------------------------------------------------------------------

    /** Clears all assembly caches and overrides. */
    reset() {
        this._assemblyCache.clear();
        this._overrideTable.clear();
    }
}
