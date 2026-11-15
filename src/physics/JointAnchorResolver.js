/**
 * JointAnchorResolver – Berechnet lokale Gelenkanker (Phase G.4)
 *
 * Konvertiert die Weltanker aus MechanicalConnection in lokale Anker
 * relativ zu den beiden Körpern.
 *
 * Hintergrund:
 *  - MechanicalConnection.anchor ist eine Weltposition
 *  - Rapier-Gelenke benötigen lokale Positionen relativ zum jeweiligen Body
 *  - Diese Klasse berechnet die lokale Position: localAnchor = worldAnchor - bodyPosition
 */

export class JointAnchorResolver {

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Resolves local anchors and axes for both bodies of a mechanical connection.
     *
     * Supports three input formats:
     *  1. Phase G.4 extended: { anchorA, anchorB, axisA, axisB } already in local space
     *  2. Legacy world anchor: { anchor, axis } — shared world anchor subtracted per body
     *  3. Connection point format: { connectionPointA, connectionPointB } — resolved via
     *     ConnectionPointManager (world positions expected pre-resolved by the caller)
     *
     * @param {object} mechConnection
     *   { anchor?, axis?, anchorA?, anchorB?, axisA?, axisB?,
     *     connectionPointA?, connectionPointB? }
     * @param {{ position: {x,y,z}, rotation: {x,y,z,w} }} bodyTransformA
     * @param {{ position: {x,y,z}, rotation: {x,y,z,w} }} bodyTransformB
     * @returns {{ anchorA: {x,y,z}, anchorB: {x,y,z}, axisA: {x,y,z}, axisB: {x,y,z} }}
     */
    static resolveAnchors(mechConnection, bodyTransformA, bodyTransformB) {
        const DEFAULT_AXIS = { x: 0, y: 1, z: 0 };

        let anchorA, anchorB, axisA, axisB;

        // ── Format 1: Phase G.4 pre-computed local anchors ──────────────
        if (mechConnection.anchorA !== undefined && mechConnection.anchorB !== undefined) {
            anchorA = { ...mechConnection.anchorA };
            anchorB = { ...mechConnection.anchorB };
            axisA   = mechConnection.axisA ? { ...mechConnection.axisA } : DEFAULT_AXIS;
            axisB   = mechConnection.axisB ? { ...mechConnection.axisB } : DEFAULT_AXIS;
            return { anchorA, anchorB, axisA, axisB };
        }

        // ── Format 2: Legacy single world anchor ────────────────────────
        if (mechConnection.anchor !== undefined) {
            const worldAnchor = mechConnection.anchor;
            anchorA = JointAnchorResolver.worldToLocal(
                worldAnchor,
                bodyTransformA.position,
                bodyTransformA.rotation
            );
            anchorB = JointAnchorResolver.worldToLocal(
                worldAnchor,
                bodyTransformB.position,
                bodyTransformB.rotation
            );

            // Axis: convert shared world axis into each body's local space.
            // If no axis provided fall back to DEFAULT_AXIS.
            const worldAxis = mechConnection.axis
                ? JointAnchorResolver._normalise(mechConnection.axis)
                : DEFAULT_AXIS;

            axisA = JointAnchorResolver.rotateVector(
                worldAxis,
                JointAnchorResolver.quaternionInverse(bodyTransformA.rotation)
            );
            axisB = JointAnchorResolver.rotateVector(
                worldAxis,
                JointAnchorResolver.quaternionInverse(bodyTransformB.rotation)
            );
            return { anchorA, anchorB, axisA, axisB };
        }

        // ── Format 3: Named connection points ────────────────────────────
        // Connection point data is expected to be pre-resolved into world
        // positions by the caller and stored as connectionPointA / connectionPointB.
        if (
            mechConnection.connectionPointA !== undefined &&
            mechConnection.connectionPointB !== undefined
        ) {
            anchorA = JointAnchorResolver.worldToLocal(
                mechConnection.connectionPointA,
                bodyTransformA.position,
                bodyTransformA.rotation
            );
            anchorB = JointAnchorResolver.worldToLocal(
                mechConnection.connectionPointB,
                bodyTransformB.position,
                bodyTransformB.rotation
            );

            const worldAxis = mechConnection.axis
                ? JointAnchorResolver._normalise(mechConnection.axis)
                : DEFAULT_AXIS;

            axisA = JointAnchorResolver.rotateVector(
                worldAxis,
                JointAnchorResolver.quaternionInverse(bodyTransformA.rotation)
            );
            axisB = JointAnchorResolver.rotateVector(
                worldAxis,
                JointAnchorResolver.quaternionInverse(bodyTransformB.rotation)
            );
            return { anchorA, anchorB, axisA, axisB };
        }

        // ── Fallback: zero anchors, default axis ─────────────────────────
        console.warn(
            '[JointAnchorResolver] No valid anchor data found — using zero anchors.',
            mechConnection
        );
        return {
            anchorA: { x: 0, y: 0, z: 0 },
            anchorB: { x: 0, y: 0, z: 0 },
            axisA:   DEFAULT_AXIS,
            axisB:   DEFAULT_AXIS,
        };
    }

    // ------------------------------------------------------------------
    // Coordinate-space helpers
    // ------------------------------------------------------------------

    /**
     * Converts a world-space point into body-local space.
     *
     * localPoint = inverseRotation * (worldPoint - bodyPosition)
     *
     * @param {{x:number, y:number, z:number}} worldPoint
     * @param {{x:number, y:number, z:number}} bodyPosition
     * @param {{x:number, y:number, z:number, w:number}} bodyRotationQuat
     * @returns {{x:number, y:number, z:number}}
     */
    static worldToLocal(worldPoint, bodyPosition, bodyRotationQuat) {
        const relative = {
            x: worldPoint.x - bodyPosition.x,
            y: worldPoint.y - bodyPosition.y,
            z: worldPoint.z - bodyPosition.z,
        };
        const invRot = JointAnchorResolver.quaternionInverse(bodyRotationQuat);
        return JointAnchorResolver.rotateVector(relative, invRot);
    }

    /**
     * Converts a body-local point into world space.
     *
     * worldPoint = rotation * localPoint + bodyPosition
     *
     * @param {{x:number, y:number, z:number}} localPoint
     * @param {{x:number, y:number, z:number}} bodyPosition
     * @param {{x:number, y:number, z:number, w:number}} bodyRotationQuat
     * @returns {{x:number, y:number, z:number}}
     */
    static localToWorld(localPoint, bodyPosition, bodyRotationQuat) {
        const rotated = JointAnchorResolver.rotateVector(localPoint, bodyRotationQuat);
        return {
            x: rotated.x + bodyPosition.x,
            y: rotated.y + bodyPosition.y,
            z: rotated.z + bodyPosition.z,
        };
    }

    // ------------------------------------------------------------------
    // Quaternion & vector math
    // ------------------------------------------------------------------

    /**
     * Converts XYZ Euler angles (in radians) to a unit quaternion.
     * Rotation order: X → Y → Z (intrinsic / Tait-Bryan).
     *
     * @param {{x:number, y:number, z:number}} euler  angles in radians
     * @returns {{x:number, y:number, z:number, w:number}}
     */
    static eulerToQuaternion(euler) {
        const { x, y, z } = euler;

        const cx = Math.cos(x * 0.5);
        const sx = Math.sin(x * 0.5);
        const cy = Math.cos(y * 0.5);
        const sy = Math.sin(y * 0.5);
        const cz = Math.cos(z * 0.5);
        const sz = Math.sin(z * 0.5);

        return {
            x:  sx * cy * cz + cx * sy * sz,
            y:  cx * sy * cz - sx * cy * sz,
            z:  cx * cy * sz + sx * sy * cz,
            w:  cx * cy * cz - sx * sy * sz,
        };
    }

    /**
     * Returns the multiplicative inverse (conjugate for unit quaternions) of q.
     *
     * q⁻¹ = conjugate(q) / |q|²
     *
     * @param {{x:number, y:number, z:number, w:number}} q
     * @returns {{x:number, y:number, z:number, w:number}}
     */
    static quaternionInverse(q) {
        const lenSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
        if (lenSq < 1e-20) return { x: 0, y: 0, z: 0, w: 1 }; // identity fallback
        const inv = 1 / lenSq;
        return {
            x: -q.x * inv,
            y: -q.y * inv,
            z: -q.z * inv,
            w:  q.w * inv,
        };
    }

    /**
     * Multiplies two quaternions: returns p * q.
     *
     * @param {{x:number, y:number, z:number, w:number}} p
     * @param {{x:number, y:number, z:number, w:number}} q
     * @returns {{x:number, y:number, z:number, w:number}}
     */
    static quaternionMultiply(p, q) {
        return {
            x:  p.w * q.x + p.x * q.w + p.y * q.z - p.z * q.y,
            y:  p.w * q.y - p.x * q.z + p.y * q.w + p.z * q.x,
            z:  p.w * q.z + p.x * q.y - p.y * q.x + p.z * q.w,
            w:  p.w * q.w - p.x * q.x - p.y * q.y - p.z * q.z,
        };
    }

    /**
     * Rotates a 3D vector by a quaternion: returns q * v * q⁻¹.
     *
     * Uses the optimised form:
     *   t = 2 × cross(q.xyz, v)
     *   result = v + q.w × t + cross(q.xyz, t)
     *
     * @param {{x:number, y:number, z:number}} v
     * @param {{x:number, y:number, z:number, w:number}} q
     * @returns {{x:number, y:number, z:number}}
     */
    static rotateVector(v, q) {
        const { x: qx, y: qy, z: qz, w: qw } = q;
        const { x: vx, y: vy, z: vz } = v;

        // t = 2 * cross(q.xyz, v)
        const tx = 2 * (qy * vz - qz * vy);
        const ty = 2 * (qz * vx - qx * vz);
        const tz = 2 * (qx * vy - qy * vx);

        // result = v + q.w * t + cross(q.xyz, t)
        return {
            x: vx + qw * tx + qy * tz - qz * ty,
            y: vy + qw * ty + qz * tx - qx * tz,
            z: vz + qw * tz + qx * ty - qy * tx,
        };
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    /**
     * Returns a normalised copy of a 3D vector.
     * Returns the zero-vector unchanged if length is ~0.
     *
     * @param {{x:number, y:number, z:number}} v
     * @returns {{x:number, y:number, z:number}}
     */
    static _normalise(v) {
        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (len < 1e-10) return { x: 0, y: 0, z: 0 };
        return { x: v.x / len, y: v.y / len, z: v.z / len };
    }
}
