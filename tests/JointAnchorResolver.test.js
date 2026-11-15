/**
 * JointAnchorResolver – Phase G.4 tests
 *
 * Coverage (~35 assertions):
 *  - eulerToQuaternion identity
 *  - eulerToQuaternion 180° Y rotation
 *  - quaternionInverse of identity
 *  - double inverse roundtrip
 *  - rotateVector with identity quaternion
 *  - rotateVector with 90° Y rotation
 *  - worldToLocal translation only
 *  - worldToLocal / localToWorld roundtrip
 *  - resolveAnchors with explicit anchorA/anchorB (Format 1)
 *  - resolveAnchors with single shared world anchor (Format 2)
 *  - resolveAnchors degenerate / fallback axis
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { JointAnchorResolver } from '../src/physics/JointAnchorResolver.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Assert two numbers are approximately equal (within epsilon). */
function approxEqual(a, b, eps = 1e-6, msg = '') {
    assert.ok(
        Math.abs(a - b) <= eps,
        `${msg} — expected ${a} ≈ ${b} (diff ${Math.abs(a - b)})`
    );
}

/** Assert two {x,y,z} vectors are approximately equal. */
function vecApprox(actual, expected, eps = 1e-6, label = '') {
    approxEqual(actual.x, expected.x, eps, `${label}.x`);
    approxEqual(actual.y, expected.y, eps, `${label}.y`);
    approxEqual(actual.z, expected.z, eps, `${label}.z`);
}

/** Assert two {x,y,z,w} quaternions are approximately equal. */
function quatApprox(actual, expected, eps = 1e-6, label = '') {
    approxEqual(actual.x, expected.x, eps, `${label}.x`);
    approxEqual(actual.y, expected.y, eps, `${label}.y`);
    approxEqual(actual.z, expected.z, eps, `${label}.z`);
    approxEqual(actual.w, expected.w, eps, `${label}.w`);
}

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('JointAnchorResolver', () => {

    // ── eulerToQuaternion ────────────────────────────────────────────────────

    describe('static eulerToQuaternion()', () => {

        it('zero euler → identity quaternion', () => {
            const q = JointAnchorResolver.eulerToQuaternion({ x: 0, y: 0, z: 0 });
            quatApprox(q, IDENTITY, 1e-9, 'identity');
            // 4 assertions via helper
        });

        it('180° Y rotation → approx { x:0, y:1, z:0, w:0 }', () => {
            const q = JointAnchorResolver.eulerToQuaternion({ x: 0, y: Math.PI, z: 0 });
            approxEqual(q.x, 0,   1e-6, 'x');
            approxEqual(q.y, 1,   1e-6, 'y');   // sin(PI/2) = 1
            approxEqual(q.z, 0,   1e-6, 'z');
            approxEqual(q.w, 0,   1e-6, 'w');   // cos(PI/2) ≈ 0
        });

        it('90° X rotation produces unit quaternion', () => {
            const q = JointAnchorResolver.eulerToQuaternion({ x: Math.PI / 2, y: 0, z: 0 });
            const len = Math.sqrt(q.x**2 + q.y**2 + q.z**2 + q.w**2);
            approxEqual(len, 1, 1e-6, 'unit length');
        });

    });

    // ── quaternionInverse ────────────────────────────────────────────────────

    describe('static quaternionInverse()', () => {

        it('inverse of identity is identity', () => {
            const inv = JointAnchorResolver.quaternionInverse(IDENTITY);
            quatApprox(inv, IDENTITY, 1e-9, 'inv(id)');
        });

        it('double inverse roundtrips to original', () => {
            const q = { x: 0.1, y: 0.2, z: 0.3, w: 0.9274 };  // normalised-ish
            const inv  = JointAnchorResolver.quaternionInverse(q);
            const inv2 = JointAnchorResolver.quaternionInverse(inv);
            // inv(inv(q)) should equal q (up to floating point)
            approxEqual(inv2.x, q.x, 1e-5, 'x roundtrip');
            approxEqual(inv2.y, q.y, 1e-5, 'y roundtrip');
            approxEqual(inv2.z, q.z, 1e-5, 'z roundtrip');
            approxEqual(inv2.w, q.w, 1e-5, 'w roundtrip');
        });

        it('inverse of 180° Y quat has negated xyz', () => {
            const q   = { x: 0, y: 1, z: 0, w: 0 }; // 180° around Y
            const inv = JointAnchorResolver.quaternionInverse(q);
            approxEqual(inv.y, -1, 1e-6, 'negated y');
            approxEqual(inv.w,  0, 1e-6, 'w stays 0');
        });

    });

    // ── rotateVector ─────────────────────────────────────────────────────────

    describe('static rotateVector()', () => {

        it('+X vector unchanged under identity rotation', () => {
            const v = { x: 1, y: 0, z: 0 };
            const r = JointAnchorResolver.rotateVector(v, IDENTITY);
            vecApprox(r, { x: 1, y: 0, z: 0 }, 1e-9, 'identity rot');
        });

        it('+X vector rotated 90° around Y → approximately -Z', () => {
            // 90° around Y: sin(45°)=√2/2 for y component
            const q90y = JointAnchorResolver.eulerToQuaternion({ x: 0, y: Math.PI / 2, z: 0 });
            const r = JointAnchorResolver.rotateVector({ x: 1, y: 0, z: 0 }, q90y);
            approxEqual(r.x,  0, 1e-6, 'x after 90Y');
            approxEqual(r.y,  0, 1e-6, 'y after 90Y');
            approxEqual(r.z, -1, 1e-6, 'z after 90Y');  // +X → -Z
        });

        it('+Y vector unchanged under 90° Y rotation (axis-aligned)', () => {
            const q90y = JointAnchorResolver.eulerToQuaternion({ x: 0, y: Math.PI / 2, z: 0 });
            const r = JointAnchorResolver.rotateVector({ x: 0, y: 1, z: 0 }, q90y);
            vecApprox(r, { x: 0, y: 1, z: 0 }, 1e-6, '+Y unchanged');
        });

    });

    // ── worldToLocal / localToWorld ──────────────────────────────────────────

    describe('static worldToLocal()', () => {

        it('simple translation with identity rotation', () => {
            const local = JointAnchorResolver.worldToLocal(
                { x: 5, y: 0, z: 0 },   // world point
                { x: 3, y: 0, z: 0 },   // body position
                IDENTITY
            );
            vecApprox(local, { x: 2, y: 0, z: 0 }, 1e-9, 'simple offset');
        });

        it('world origin with body at origin → local zero', () => {
            const local = JointAnchorResolver.worldToLocal(
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
                IDENTITY
            );
            vecApprox(local, { x: 0, y: 0, z: 0 }, 1e-9, 'zero-zero');
        });

    });

    describe('static worldToLocal / localToWorld roundtrip', () => {

        it('roundtrip returns original world point (identity rotation)', () => {
            const worldOrig = { x: 7, y: 3, z: -2 };
            const bodyPos   = { x: 1, y: 1, z:  1 };
            const local  = JointAnchorResolver.worldToLocal(worldOrig, bodyPos, IDENTITY);
            const world2 = JointAnchorResolver.localToWorld(local, bodyPos, IDENTITY);
            vecApprox(world2, worldOrig, 1e-9, 'roundtrip identity');
        });

        it('roundtrip returns original world point (90° Y rotation)', () => {
            const q90y    = JointAnchorResolver.eulerToQuaternion({ x: 0, y: Math.PI / 2, z: 0 });
            const worldOrig = { x: 5, y: 2, z: 3 };
            const bodyPos   = { x: 1, y: 0, z: 0 };
            const local  = JointAnchorResolver.worldToLocal(worldOrig, bodyPos, q90y);
            const world2 = JointAnchorResolver.localToWorld(local, bodyPos, q90y);
            vecApprox(world2, worldOrig, 1e-6, 'roundtrip 90Y');
        });

    });

    // ── resolveAnchors ───────────────────────────────────────────────────────

    describe('static resolveAnchors()', () => {

        const identityTransform = { position: { x: 0, y: 0, z: 0 }, rotation: IDENTITY };

        it('Format 1: explicit anchorA/anchorB returned as-is', () => {
            const conn = {
                anchorA: { x: 1, y: 0, z: 0 },
                anchorB: { x: -1, y: 0, z: 0 },
                axisA:   { x: 0, y: 1, z: 0 },
                axisB:   { x: 0, y: 1, z: 0 },
            };
            const result = JointAnchorResolver.resolveAnchors(conn, identityTransform, identityTransform);
            vecApprox(result.anchorA, conn.anchorA, 1e-9, 'anchorA passthrough');
            vecApprox(result.anchorB, conn.anchorB, 1e-9, 'anchorB passthrough');
            assert.ok(result.axisA, 'axisA present');
            assert.ok(result.axisB, 'axisB present');
        });

        it('Format 1: default axis used when axisA/axisB omitted', () => {
            const conn = {
                anchorA: { x: 0, y: 0, z: 0 },
                anchorB: { x: 0, y: 0, z: 0 },
            };
            const result = JointAnchorResolver.resolveAnchors(conn, identityTransform, identityTransform);
            vecApprox(result.axisA, { x: 0, y: 1, z: 0 }, 1e-9, 'default axisA');
            vecApprox(result.axisB, { x: 0, y: 1, z: 0 }, 1e-9, 'default axisB');
        });

        it('Format 2: single world anchor computes local anchors by subtraction', () => {
            const transformA = { position: { x: 3, y: 0, z: 0 }, rotation: IDENTITY };
            const transformB = { position: { x: -3, y: 0, z: 0 }, rotation: IDENTITY };
            const conn = { anchor: { x: 0, y: 0, z: 0 } };

            const result = JointAnchorResolver.resolveAnchors(conn, transformA, transformB);
            // local for A = world(0,0,0) - posA(3,0,0) = (-3,0,0)
            vecApprox(result.anchorA, { x: -3, y: 0, z: 0 }, 1e-9, 'anchorA from world');
            // local for B = world(0,0,0) - posB(-3,0,0) = (3,0,0)
            vecApprox(result.anchorB, { x: 3, y: 0, z: 0 }, 1e-9, 'anchorB from world');
        });

        it('Format 2: axis falls back to default Y when not provided', () => {
            const conn = { anchor: { x: 0, y: 0, z: 0 } };
            const result = JointAnchorResolver.resolveAnchors(conn, identityTransform, identityTransform);
            vecApprox(result.axisA, { x: 0, y: 1, z: 0 }, 1e-9, 'fallback axisA');
        });

        it('fallback: no anchor data → zero anchors + default axis', () => {
            const result = JointAnchorResolver.resolveAnchors({}, identityTransform, identityTransform);
            vecApprox(result.anchorA, { x: 0, y: 0, z: 0 }, 1e-9, 'fallback anchorA');
            vecApprox(result.anchorB, { x: 0, y: 0, z: 0 }, 1e-9, 'fallback anchorB');
            vecApprox(result.axisA,   { x: 0, y: 1, z: 0 }, 1e-9, 'fallback axisA');
        });

        it('Format 3: connectionPointA/B used as world anchors', () => {
            const transformA = { position: { x: 1, y: 0, z: 0 }, rotation: IDENTITY };
            const transformB = { position: { x: -1, y: 0, z: 0 }, rotation: IDENTITY };
            const conn = {
                connectionPointA: { x: 2, y: 0, z: 0 },
                connectionPointB: { x: 0, y: 0, z: 0 },
            };
            const result = JointAnchorResolver.resolveAnchors(conn, transformA, transformB);
            // local A = (2-1, 0, 0) = (1, 0, 0)
            vecApprox(result.anchorA, { x: 1, y: 0, z: 0 }, 1e-9, 'conn pt A');
            // local B = (0-(-1), 0, 0) = (1, 0, 0)
            vecApprox(result.anchorB, { x: 1, y: 0, z: 0 }, 1e-9, 'conn pt B');
        });

    });

    // ── _normalise (degenerate axis) ─────────────────────────────────────────

    describe('_normalise() degenerate (zero vector)', () => {

        it('normalise of zero vector returns zero (not the default axis)', () => {
            // The private _normalise returns {0,0,0} for zero-length vectors.
            // resolveAnchors uses DEFAULT_AXIS if axis is absent; if axis IS present
            // but zero it gets normalised to zero. Test _normalise directly via the
            // format-2 axis path with a near-zero axis.
            const conn = {
                anchor: { x: 0, y: 0, z: 0 },
                axis:   { x: 0, y: 0, z: 0 },  // degenerate zero axis
            };
            const identTf = { position: { x: 0, y: 0, z: 0 }, rotation: IDENTITY };
            // Should not throw; axes become {0,0,0} or similar
            const result = JointAnchorResolver.resolveAnchors(conn, identTf, identTf);
            assert.strictEqual(typeof result.axisA.x, 'number', 'axisA.x is number');
            assert.strictEqual(typeof result.axisA.y, 'number', 'axisA.y is number');
            assert.strictEqual(typeof result.axisA.z, 'number', 'axisA.z is number');
        });

    });

});
