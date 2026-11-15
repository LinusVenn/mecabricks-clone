/**
 * PhysicsJointFactory – Erstellt Rapier-Gelenke aus MechanicalConnection-Daten (Phase G.4)
 *
 * Übersetzt jeden mechanischen Gelenktyp in den passenden Rapier-Constraint:
 *
 *  rigid     → Fixed Joint
 *  revolute  → Revolute Joint (ggf. mit Winkelbegrenzer)
 *  prismatic → Prismatic Joint (ggf. mit Translationsbegrenzer)
 *  ball      → Spherical Joint
 *  gear      → Zwei Revolute Joints + GearCoupling-Eintrag
 *  axle      → Revolute Joint (gemeinsame Drehachse, keine Begrenzer)
 */

import { JointAnchorResolver } from './JointAnchorResolver.js';
import { MECHANICAL_CONNECTION_TYPES } from '../connections/MechanicalConnectionManager.js';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Default anchor when a body transform is unavailable. */
const ZERO_VEC  = Object.freeze({ x: 0, y: 0, z: 0 });
/** Default rotation axis (Y-up). */
const AXIS_Y    = Object.freeze({ x: 0, y: 1, z: 0 });
/** Identity quaternion. */
const QUAT_IDENTITY = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

// ---------------------------------------------------------------------------

/**
 * @typedef {object} JointCreationResult
 * @property {number}        jointHandle   Rapier handle returned by world.createImpulseJoint
 * @property {string}        type          Normalised connection type string
 * @property {GearCoupling?} gearCoupling  Present only for 'gear' connections
 */

/**
 * @typedef {object} GearCoupling
 * @property {'gear'}  type
 * @property {number}  jointHandleA
 * @property {number}  jointHandleB
 * @property {string}  instanceIdA
 * @property {string}  instanceIdB
 * @property {number}  gearRatio     ω_A / ω_B = -z_B / z_A  (negative = opposite rotation)
 * @property {number|null} toothCountA
 * @property {number|null} toothCountB
 */

export class PhysicsJointFactory {

    // ------------------------------------------------------------------
    // Construction
    // ------------------------------------------------------------------

    /**
     * @param {{ adapter: object, physicsWorld: object }} options
     *   adapter      – physics adapter providing body-lookup helpers
     *   physicsWorld – the live Rapier World instance
     */
    constructor({ adapter, physicsWorld }) {
        if (!adapter)      throw new Error('[PhysicsJointFactory] adapter is required');
        if (!physicsWorld) throw new Error('[PhysicsJointFactory] physicsWorld is required');

        /** @private */
        this._adapter = adapter;
        /** @private */
        this._world   = physicsWorld;

        /** @private @type {{ created: number, removed: number, failed: number }} */
        this._stats = { created: 0, removed: 0, failed: 0 };

        /**
         * Internal handle registry: handle → { type, instanceIdA, instanceIdB }
         * @private @type {Map<number, object>}
         */
        this._registry = new Map();
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Creates a Rapier joint from a MechanicalConnection.
     *
     * @param {object} mechConnection   MechanicalConnection object
     * @param {Map<string, {position:{x,y,z}, rotation:{x,y,z,w}}>} instanceTransforms
     * @returns {JointCreationResult|null}
     */
    createJoint(mechConnection, instanceTransforms) {
        const { id, type, instanceIdA, instanceIdB } = mechConnection;

        // ── Resolve bodies ───────────────────────────────────────────────
        const bodyA = this._adapter.getBodyForInstance?.(instanceIdA) ?? null;
        const bodyB = this._adapter.getBodyForInstance?.(instanceIdB) ?? null;

        if (!bodyA || !bodyB) {
            console.warn(
                `[PhysicsJointFactory] Cannot create joint "${id}": ` +
                `missing body for instance ${!bodyA ? instanceIdA : instanceIdB}`
            );
            this._stats.failed++;
            return null;
        }

        // ── Resolve transforms ───────────────────────────────────────────
        const txA = instanceTransforms.get(instanceIdA) ?? {
            position: ZERO_VEC,
            rotation: QUAT_IDENTITY,
        };
        const txB = instanceTransforms.get(instanceIdB) ?? {
            position: ZERO_VEC,
            rotation: QUAT_IDENTITY,
        };

        // ── Resolve anchors ──────────────────────────────────────────────
        let anchors;
        try {
            anchors = JointAnchorResolver.resolveAnchors(mechConnection, txA, txB);
        } catch (err) {
            console.error(`[PhysicsJointFactory] Anchor resolution failed for "${id}":`, err);
            this._stats.failed++;
            return null;
        }

        const bodies = { bodyA, bodyB };

        // ── Dispatch by type ─────────────────────────────────────────────
        try {
            let result = null;

            switch (type) {
                case MECHANICAL_CONNECTION_TYPES.RIGID:
                    result = this._handleRigid(bodies, anchors, mechConnection);
                    break;

                case MECHANICAL_CONNECTION_TYPES.REVOLUTE:
                case MECHANICAL_CONNECTION_TYPES.AXLE:
                    result = this._handleRevolute(bodies, anchors, mechConnection);
                    break;

                case MECHANICAL_CONNECTION_TYPES.PRISMATIC:
                    result = this._handlePrismatic(bodies, anchors, mechConnection);
                    break;

                case MECHANICAL_CONNECTION_TYPES.BALL:
                    result = this._handleBall(bodies, anchors, mechConnection);
                    break;

                case MECHANICAL_CONNECTION_TYPES.GEAR:
                    result = this._handleGear(bodies, anchors, mechConnection, instanceIdA, instanceIdB);
                    break;

                default:
                    console.warn(`[PhysicsJointFactory] Unknown joint type "${type}" — skipping.`);
                    this._stats.failed++;
                    return null;
            }

            if (result) {
                this._stats.created++;
                // For gear connections the primary handle is jointHandleA
                const primaryHandle = result.gearCoupling
                    ? result.gearCoupling.jointHandleA
                    : result.jointHandle;
                this._registry.set(primaryHandle, { type, instanceIdA, instanceIdB });
            }
            return result;

        } catch (err) {
            console.error(`[PhysicsJointFactory] Failed creating joint "${id}" (type=${type}):`, err);
            this._stats.failed++;
            return null;
        }
    }

    /**
     * Removes a joint from the physics world by its handle.
     *
     * @param {number} jointHandle
     */
    removeJoint(jointHandle) {
        try {
            const joint = this._world.getImpulseJoint(jointHandle);
            if (joint) {
                this._world.removeImpulseJoint(joint, /* wakeUp */ true);
                this._registry.delete(jointHandle);
                this._stats.removed++;
            } else {
                console.warn(`[PhysicsJointFactory] removeJoint: handle ${jointHandle} not found.`);
            }
        } catch (err) {
            console.error(`[PhysicsJointFactory] removeJoint failed for handle ${jointHandle}:`, err);
        }
    }

    /**
     * Creation / removal / failure counters.
     * @returns {{ created: number, removed: number, failed: number }}
     */
    get stats() {
        return { ...this._stats };
    }

    // ------------------------------------------------------------------
    // Joint creation primitives (also usable directly by tests)
    // ------------------------------------------------------------------

    /**
     * Creates a Fixed (rigid) joint.
     *
     * @param {{ bodyA, bodyB }} bodies
     * @param {{ anchorA, anchorB, axisA, axisB }} anchors
     * @returns {{ jointHandle: number, type: string }}
     */
    createRigidJoint(bodies, anchors) {
        const { bodyA, bodyB } = bodies;
        const { anchorA, anchorB } = anchors;

        const params = this._RAPIER().JointData.fixed(
            { x: anchorA.x, y: anchorA.y, z: anchorA.z }, QUAT_IDENTITY,
            { x: anchorB.x, y: anchorB.y, z: anchorB.z }, QUAT_IDENTITY
        );
        const joint = this._world.createImpulseJoint(params, bodyA, bodyB, /* wakeUp */ true);
        return { jointHandle: joint.handle, type: MECHANICAL_CONNECTION_TYPES.RIGID };
    }

    /**
     * Creates a Revolute joint, optionally with angular limits.
     *
     * @param {{ bodyA, bodyB }} bodies
     * @param {{ anchorA, anchorB, axisA, axisB }} anchors
     * @param {{ min: number, max: number }|undefined} limits  radians
     * @returns {{ jointHandle: number, type: string }}
     */
    createRevoluteJoint(bodies, anchors, limits = undefined) {
        const { bodyA, bodyB } = bodies;
        const { anchorA, anchorB, axisA, axisB } = anchors;

        const params = this._RAPIER().JointData.revolute(
            { x: anchorA.x, y: anchorA.y, z: anchorA.z },
            { x: axisA.x,   y: axisA.y,   z: axisA.z   },
            { x: anchorB.x, y: anchorB.y, z: anchorB.z },
            { x: axisB.x,   y: axisB.y,   z: axisB.z   }
        );
        const joint = this._world.createImpulseJoint(params, bodyA, bodyB, /* wakeUp */ true);

        if (limits !== undefined) {
            joint.setLimits(limits.min, limits.max);
        }

        return { jointHandle: joint.handle, type: MECHANICAL_CONNECTION_TYPES.REVOLUTE };
    }

    /**
     * Creates a Prismatic joint, optionally with translation limits.
     *
     * @param {{ bodyA, bodyB }} bodies
     * @param {{ anchorA, anchorB, axisA, axisB }} anchors
     * @param {{x,y,z}} axis  slide axis (world-space, will be used as-is after anchor resolution)
     * @param {{ min: number, max: number }|undefined} limits  metres
     * @returns {{ jointHandle: number, type: string }}
     */
    createPrismaticJoint(bodies, anchors, axis, limits = undefined) {
        const { bodyA, bodyB } = bodies;
        const { anchorA, anchorB } = anchors;
        const slideAxis = axis ?? anchors.axisA;

        const params = this._RAPIER().JointData.prismatic(
            { x: anchorA.x,   y: anchorA.y,   z: anchorA.z   },
            { x: anchorB.x,   y: anchorB.y,   z: anchorB.z   },
            { x: slideAxis.x, y: slideAxis.y, z: slideAxis.z }
        );
        const joint = this._world.createImpulseJoint(params, bodyA, bodyB, /* wakeUp */ true);

        if (limits !== undefined) {
            joint.setLimits(limits.min, limits.max);
        }

        return { jointHandle: joint.handle, type: MECHANICAL_CONNECTION_TYPES.PRISMATIC };
    }

    /**
     * Creates a Spherical (ball) joint.
     *
     * @param {{ bodyA, bodyB }} bodies
     * @param {{ anchorA, anchorB }} anchors
     * @returns {{ jointHandle: number, type: string }}
     */
    createSphericalJoint(bodies, anchors) {
        const { bodyA, bodyB } = bodies;
        const { anchorA, anchorB } = anchors;

        const params = this._RAPIER().JointData.spherical(
            { x: anchorA.x, y: anchorA.y, z: anchorA.z },
            { x: anchorB.x, y: anchorB.y, z: anchorB.z }
        );
        const joint = this._world.createImpulseJoint(params, bodyA, bodyB, /* wakeUp */ true);
        return { jointHandle: joint.handle, type: MECHANICAL_CONNECTION_TYPES.BALL };
    }

    /**
     * Creates two revolute joints (one per gear) and a GearCoupling descriptor.
     *
     * @param {{ bodyA, bodyB }} bodies
     * @param {{ anchorA, anchorB, axisA, axisB }} anchors
     * @param {number} gearRatio   ω_A / ω_B = -z_B / z_A
     * @param {string} instanceIdA
     * @param {string} instanceIdB
     * @param {number|null} toothCountA
     * @param {number|null} toothCountB
     * @returns {{ jointA: object, jointB: object, gearCoupling: GearCoupling }}
     */
    createGearJoints(bodies, anchors, gearRatio, instanceIdA, instanceIdB, toothCountA = null, toothCountB = null) {
        const { bodyA, bodyB } = bodies;
        const { anchorA, anchorB, axisA, axisB } = anchors;
        const RAPIER = this._RAPIER();

        // Each gear body gets its own revolute joint (free-spinning, no limits)
        const paramsA = RAPIER.JointData.revolute(
            { x: anchorA.x, y: anchorA.y, z: anchorA.z },
            { x: axisA.x,   y: axisA.y,   z: axisA.z   },
            { x: anchorA.x, y: anchorA.y, z: anchorA.z },  // anchor on body B is same world pos
            { x: axisA.x,   y: axisA.y,   z: axisA.z   }
        );
        const paramsB = RAPIER.JointData.revolute(
            { x: anchorB.x, y: anchorB.y, z: anchorB.z },
            { x: axisB.x,   y: axisB.y,   z: axisB.z   },
            { x: anchorB.x, y: anchorB.y, z: anchorB.z },
            { x: axisB.x,   y: axisB.y,   z: axisB.z   }
        );

        const jointA = this._world.createImpulseJoint(paramsA, bodyA, bodyB, true);
        const jointB = this._world.createImpulseJoint(paramsB, bodyA, bodyB, true);

        /** @type {GearCoupling} */
        const gearCoupling = {
            type:         'gear',
            jointHandleA: jointA.handle,
            jointHandleB: jointB.handle,
            instanceIdA,
            instanceIdB,
            gearRatio,
            toothCountA,
            toothCountB,
        };

        this._registry.set(jointA.handle, { type: 'gear', instanceIdA, instanceIdB });
        this._registry.set(jointB.handle, { type: 'gear', instanceIdA, instanceIdB });

        return { jointA, jointB, gearCoupling };
    }

    // ------------------------------------------------------------------
    // Private dispatch handlers
    // ------------------------------------------------------------------

    /** @private */
    _handleRigid(bodies, anchors, mc) {
        const result = this.createRigidJoint(bodies, anchors);
        return { jointHandle: result.jointHandle, type: mc.type };
    }

    /** @private */
    _handleRevolute(bodies, anchors, mc) {
        const limits = this._extractLimits(mc);
        const result = this.createRevoluteJoint(bodies, anchors, limits);
        return { jointHandle: result.jointHandle, type: mc.type };
    }

    /** @private */
    _handlePrismatic(bodies, anchors, mc) {
        const limits = this._extractLimits(mc);
        const axis   = mc.axis ?? anchors.axisA;
        const result = this.createPrismaticJoint(bodies, anchors, axis, limits);
        return { jointHandle: result.jointHandle, type: mc.type };
    }

    /** @private */
    _handleBall(bodies, anchors, mc) {
        const result = this.createSphericalJoint(bodies, anchors);
        return { jointHandle: result.jointHandle, type: mc.type };
    }

    /** @private */
    _handleGear(bodies, anchors, mc, instanceIdA, instanceIdB) {
        const toothCountA = mc.toothCountA ?? null;
        const toothCountB = mc.toothCountB ?? null;

        // gearRatio = ω_A / ω_B = -(z_B / z_A).  If tooth counts unavailable default to -1.
        let gearRatio = mc.gearRatio;
        if (gearRatio === undefined || gearRatio === null) {
            if (toothCountA && toothCountB) {
                gearRatio = -(toothCountB / toothCountA);
            } else {
                gearRatio = -1; // 1:1 opposite rotation
            }
        }

        const { jointA, jointB, gearCoupling } = this.createGearJoints(
            bodies, anchors, gearRatio,
            instanceIdA, instanceIdB,
            toothCountA, toothCountB
        );

        // Primary handle for external tracking is jointA
        return {
            jointHandle:  jointA.handle,
            type:         MECHANICAL_CONNECTION_TYPES.GEAR,
            gearCoupling,
        };
    }

    // ------------------------------------------------------------------
    // Utilities
    // ------------------------------------------------------------------

    /**
     * Extracts angular / linear limits from a MechanicalConnection if present.
     *
     * Accepts: `{ limits: { min, max } }` or `{ limitMin, limitMax }`.
     *
     * @param {object} mc
     * @returns {{ min: number, max: number }|undefined}
     * @private
     */
    _extractLimits(mc) {
        if (mc.limits && mc.limits.min !== undefined && mc.limits.max !== undefined) {
            return { min: mc.limits.min, max: mc.limits.max };
        }
        if (mc.limitMin !== undefined && mc.limitMax !== undefined) {
            return { min: mc.limitMin, max: mc.limitMax };
        }
        return undefined;
    }

    /**
     * Lazily resolves the global RAPIER namespace from the adapter or window.
     * @private
     */
    _RAPIER() {
        return (
            this._adapter.RAPIER ??
            this._adapter.getRapier?.() ??
            (typeof globalThis !== 'undefined' && globalThis.RAPIER) ??
            (() => { throw new Error('[PhysicsJointFactory] RAPIER not available on adapter or global scope'); })()
        );
    }
}
