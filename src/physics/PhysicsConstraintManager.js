/**
 * PhysicsConstraintManager – Verwaltet alle physikalischen Constraints (Phase G.4/G.5)
 *
 * Zentraler Verwalter für die Übersetzung von mechanischen Verbindungen in
 * physikalische Gelenke und Kopplungen.
 *
 * Koordiniert:
 *  - PhysicsJointFactory für Rapier-Gelenke
 *  - GearCoupling-System für Zahnradübersetzungen
 *  - Synchronisation mit MechanicalConnectionManager
 */

import { PhysicsJointFactory } from './PhysicsJointFactory.js';

// ---------------------------------------------------------------------------

/**
 * @typedef {object} ConstraintRecord
 * @property {number}        jointHandle
 * @property {string}        type
 * @property {string}        mechConnectionId
 * @property {string}        instanceIdA
 * @property {string}        instanceIdB
 * @property {GearCoupling?} gearCoupling
 */

/**
 * @typedef {object} BuildResult
 * @property {number}   created  Number of successfully created constraints
 * @property {number}   failed   Number of failed attempts
 * @property {string[]} errors   Human-readable failure descriptions
 */

export class PhysicsConstraintManager {

    // ------------------------------------------------------------------
    // Construction
    // ------------------------------------------------------------------

    /**
     * @param {{
     *   adapter:      object,
     *   physicsWorld: object,
     *   jointFactory?: PhysicsJointFactory
     * }} options
     */
    constructor({ adapter, physicsWorld, jointFactory = null }) {
        if (!adapter)      throw new Error('[PhysicsConstraintManager] adapter is required');
        if (!physicsWorld) throw new Error('[PhysicsConstraintManager] physicsWorld is required');

        /** @private */
        this._adapter = adapter;
        /** @private */
        this._world   = physicsWorld;

        /**
         * Allow injection of a pre-configured factory (useful for testing).
         * @private
         */
        this._factory = jointFactory ?? new PhysicsJointFactory({ adapter, physicsWorld });

        /**
         * mechConnectionId → ConstraintRecord
         * @private @type {Map<string, ConstraintRecord>}
         */
        this._constraints = new Map();

        /**
         * Active gear couplings managed by Phase G.5 step logic.
         * @private @type {GearCoupling[]}
         */
        this._gearCouplings = [];
    }

    // ------------------------------------------------------------------
    // Bulk construction
    // ------------------------------------------------------------------

    /**
     * Iterates every connection in a MechanicalConnectionManager and creates
     * the corresponding Rapier joint.
     *
     * Existing constraints for connections that are already registered are
     * skipped (idempotent — safe to call multiple times).
     *
     * @param {object} mechanicalManager  Has `.getAllConnections() → MechanicalConnection[]`
     * @param {Map<string, {position,rotation}>} instanceTransforms
     * @returns {BuildResult}
     */
    buildFromMechanicalManager(mechanicalManager, instanceTransforms) {
        const errors  = [];
        let   created = 0;
        let   failed  = 0;

        const connections = mechanicalManager.getAllConnections?.() ?? [];

        for (const mc of connections) {
            if (this._constraints.has(mc.id)) continue; // already registered

            const ok = this.createConstraint(mc, instanceTransforms);
            if (ok) {
                created++;
            } else {
                failed++;
                errors.push(
                    `Failed to create constraint for connection "${mc.id}" (type=${mc.type}, ` +
                    `A=${mc.instanceIdA}, B=${mc.instanceIdB})`
                );
            }
        }

        if (failed > 0) {
            console.warn(
                `[PhysicsConstraintManager] buildFromMechanicalManager: ` +
                `${created} created, ${failed} failed.`
            );
        }

        return { created, failed, errors };
    }

    // ------------------------------------------------------------------
    // CRUD
    // ------------------------------------------------------------------

    /**
     * Creates a single constraint from a MechanicalConnection and registers it.
     *
     * @param {object} mechConnection
     * @param {Map<string, {position,rotation}>} instanceTransforms
     * @returns {boolean} true if the joint was created successfully
     */
    createConstraint(mechConnection, instanceTransforms) {
        const result = this._factory.createJoint(mechConnection, instanceTransforms);
        if (!result) return false;

        /** @type {ConstraintRecord} */
        const record = {
            jointHandle:     result.jointHandle,
            type:            result.type,
            mechConnectionId: mechConnection.id,
            instanceIdA:     mechConnection.instanceIdA,
            instanceIdB:     mechConnection.instanceIdB,
            gearCoupling:    result.gearCoupling ?? null,
        };

        this._constraints.set(mechConnection.id, record);

        if (result.gearCoupling) {
            this._gearCouplings.push(result.gearCoupling);
        }

        return true;
    }

    /**
     * Removes the Rapier joint for a given mechConnectionId.
     *
     * For gear connections, also removes the secondary joint and the
     * corresponding GearCoupling entry.
     *
     * @param {string} mechConnectionId
     * @returns {boolean} true if found and removed
     */
    removeConstraint(mechConnectionId) {
        const record = this._constraints.get(mechConnectionId);
        if (!record) return false;

        // Remove primary joint
        this._factory.removeJoint(record.jointHandle);

        // Remove secondary joint + gear coupling entry for gear connections
        if (record.gearCoupling) {
            const gc = record.gearCoupling;
            // Only remove secondary handle if different from primary
            if (gc.jointHandleB !== record.jointHandle) {
                this._factory.removeJoint(gc.jointHandleB);
            }
            this._gearCouplings = this._gearCouplings.filter(
                g => g.jointHandleA !== gc.jointHandleA
            );
        }

        this._constraints.delete(mechConnectionId);
        return true;
    }

    /**
     * Removes all constraints that involve a specific instance (either A or B side).
     *
     * @param {string} instanceId
     * @returns {number} number of constraints removed
     */
    removeConstraintsForInstance(instanceId) {
        let removed = 0;
        for (const [connId, record] of this._constraints) {
            if (record.instanceIdA === instanceId || record.instanceIdB === instanceId) {
                this.removeConstraint(connId);
                removed++;
            }
        }
        return removed;
    }

    // ------------------------------------------------------------------
    // Phase G.5 – Gear coupling step
    // ------------------------------------------------------------------

    /**
     * Applies gear coupling constraints every physics step.
     *
     * For each active GearCoupling:
     *  1. Read angular velocity ω_A of body A along its rotation axis.
     *  2. Compute ω_B = -ω_A × gearRatio.
     *  3. Set motor velocity on joint B so body B is driven at ω_B.
     *
     * Must be called BEFORE `physicsWorld.step()`.
     *
     * @param {object} physicsWorld  Rapier World (may differ from constructor arg for testing)
     */
    applyGearCouplings(physicsWorld = this._world) {
        for (const gc of this._gearCouplings) {
            try {
                this._applyGearCoupling(gc, physicsWorld);
            } catch (err) {
                console.error(
                    `[PhysicsConstraintManager] applyGearCouplings error for ` +
                    `${gc.instanceIdA}↔${gc.instanceIdB}:`,
                    err
                );
            }
        }
    }

    /**
     * Applies a single GearCoupling.
     * @param {GearCoupling} gc
     * @param {object} world
     * @private
     */
    _applyGearCoupling(gc, world) {
        // Fetch live joints
        const jointA = world.getImpulseJoint?.(gc.jointHandleA);
        const jointB = world.getImpulseJoint?.(gc.jointHandleB);

        if (!jointA || !jointB) {
            // One or both joints have been removed — clean up stale coupling
            this._gearCouplings = this._gearCouplings.filter(g => g !== gc);
            return;
        }

        // Read ω_A: angular velocity projected onto the revolute axis of joint A.
        // Rapier's ImpulseJoint exposes .body1() / .body2() giving rigid-body handles.
        const bodyAHandle = jointA.body1();
        const bodyA = world.getRigidBody?.(bodyAHandle);
        if (!bodyA) return;

        const angVelA = bodyA.angvel?.() ?? { x: 0, y: 0, z: 0 };

        // The revolute axis in world space can be retrieved from the joint or
        // approximated from the body's current rotation + local axis.
        // We project onto the Y axis as a default (most LEGO axles are Y-aligned).
        // A more precise implementation would read jointA.data().localAxis1().
        const omegaA = angVelA.y; // scalar angular speed along primary axis

        // ω_B = -ω_A × ratio  (negative sign = opposite direction for meshing gears)
        const omegaB = -omegaA * gc.gearRatio;

        // Drive joint B with a velocity motor.
        // Rapier revolute joints support setMotorVelocity(targetVel, dampingFactor).
        const MAX_FORCE = 1e6; // N·m — effectively unconstrained
        jointB.setMotorVelocity?.(omegaB, MAX_FORCE);
    }

    // ------------------------------------------------------------------
    // Queries
    // ------------------------------------------------------------------

    /**
     * Returns the constraint record for a given mechConnectionId, or null.
     *
     * @param {string} mechConnectionId
     * @returns {ConstraintRecord|null}
     */
    getConstraintForConnection(mechConnectionId) {
        return this._constraints.get(mechConnectionId) ?? null;
    }

    /**
     * Returns all constraint records as an array.
     *
     * @returns {ConstraintRecord[]}
     */
    getAllConstraints() {
        return Array.from(this._constraints.values());
    }

    /**
     * Returns the number of active constraints.
     *
     * @returns {number}
     */
    getCount() {
        return this._constraints.size;
    }

    /**
     * Returns a copy of all active GearCoupling descriptors.
     *
     * @returns {GearCoupling[]}
     */
    getGearCouplings() {
        return [...this._gearCouplings];
    }

    /**
     * Removes all constraints and gear couplings (does NOT remove Rapier joints
     * from the world — call this only when the world is also being reset).
     */
    clear() {
        // Attempt graceful removal of all joints
        for (const record of this._constraints.values()) {
            try { this._factory.removeJoint(record.jointHandle); } catch (_) { /* ignore */ }
            if (record.gearCoupling?.jointHandleB !== record.jointHandle) {
                try { this._factory.removeJoint(record.gearCoupling?.jointHandleB); } catch (_) { /* ignore */ }
            }
        }
        this._constraints.clear();
        this._gearCouplings.length = 0;
    }
}
