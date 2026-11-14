/**
 * ConnectionCompatibility.test.js
 *
 * Tests for src/connections/ConnectionCompatibility.js
 * Runner: node:test  +  node:assert/strict  (ESM)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    ConnectionCompatibility,
    COMPATIBILITY_MATRIX,
} from '../src/connections/ConnectionCompatibility.js';
import { ConnectionPoint } from '../src/connections/ConnectionPoint.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ConnectionPoint-like object that ConnectionCompatibility
 * can work with.  Uses real ConnectionPoint instances so that the `type` and
 * `direction` getters behave exactly as in production.
 */
function makePoint(type, dir = { x: 0, y: 1, z: 0 }, extraProps = {}) {
    return new ConnectionPoint({
        id:            `${type.replace(/-/g, '_')}_0`,
        partId:        'test-part',
        type,
        localPosition: { x: 0, y: 0, z: 0 },
        direction:     dir,
        ...extraProps,
    });
}

// Anti-parallel direction to (0, 1, 0)
const UP   = { x: 0, y:  1, z: 0 };
const DOWN = { x: 0, y: -1, z: 0 };

// ---------------------------------------------------------------------------
// COMPATIBILITY_MATRIX (exported plain object)
// ---------------------------------------------------------------------------

describe('COMPATIBILITY_MATRIX', () => {

    it('is accessible as a named export', () => {
        assert.ok(COMPATIBILITY_MATRIX !== undefined);
    });

    it('is an object', () => {
        assert.strictEqual(typeof COMPATIBILITY_MATRIX, 'object');
        assert.ok(COMPATIBILITY_MATRIX !== null);
    });

    it("has a 'stud' entry", () => {
        assert.ok('stud' in COMPATIBILITY_MATRIX);
    });

    it("stud → anti-stud is 'full'", () => {
        assert.strictEqual(COMPATIBILITY_MATRIX['stud']['anti-stud'], 'full');
    });

    it("gear → gear is 'partial'", () => {
        assert.strictEqual(COMPATIBILITY_MATRIX['gear']['gear'], 'partial');
    });
});

// ---------------------------------------------------------------------------
// ConnectionCompatibility.COMPATIBILITY_MATRIX static getter
// ---------------------------------------------------------------------------

describe('ConnectionCompatibility.COMPATIBILITY_MATRIX (static Map)', () => {

    it('returns a Map', () => {
        const m = ConnectionCompatibility.COMPATIBILITY_MATRIX;
        assert.ok(m instanceof Map);
    });

    it('contains stud as a key', () => {
        assert.ok(ConnectionCompatibility.COMPATIBILITY_MATRIX.has('stud'));
    });

    it('returns the same Map on repeated access (lazy cache)', () => {
        const a = ConnectionCompatibility.COMPATIBILITY_MATRIX;
        const b = ConnectionCompatibility.COMPATIBILITY_MATRIX;
        assert.strictEqual(a, b);
    });
});

// ---------------------------------------------------------------------------
// checkTypes
// ---------------------------------------------------------------------------

describe('ConnectionCompatibility – checkTypes', () => {

    const compat = new ConnectionCompatibility();

    it("stud ↔ anti-stud → true", () => {
        assert.strictEqual(compat.checkTypes('stud', 'anti-stud'), true);
    });

    it("anti-stud ↔ stud → true (symmetric)", () => {
        assert.strictEqual(compat.checkTypes('anti-stud', 'stud'), true);
    });

    it("stud ↔ stud → false (same type cannot connect to itself)", () => {
        assert.strictEqual(compat.checkTypes('stud', 'stud'), false);
    });

    it("stud ↔ technic-hole → false", () => {
        assert.strictEqual(compat.checkTypes('stud', 'technic-hole'), false);
    });

    it("clip ↔ bar → true", () => {
        assert.strictEqual(compat.checkTypes('clip', 'bar'), true);
    });

    it("bar ↔ clip → true (symmetric)", () => {
        assert.strictEqual(compat.checkTypes('bar', 'clip'), true);
    });

    it("hinge-male ↔ hinge-female → true", () => {
        assert.strictEqual(compat.checkTypes('hinge-male', 'hinge-female'), true);
    });

    it("ball ↔ ball-socket → true", () => {
        assert.strictEqual(compat.checkTypes('ball', 'ball-socket'), true);
    });

    it("gear ↔ gear → true (partial but still compatible)", () => {
        assert.strictEqual(compat.checkTypes('gear', 'gear'), true);
    });

    it("stud ↔ clip → false", () => {
        assert.strictEqual(compat.checkTypes('stud', 'clip'), false);
    });

    it("anti-stud ↔ technic-hole → false", () => {
        assert.strictEqual(compat.checkTypes('anti-stud', 'technic-hole'), false);
    });
});

// ---------------------------------------------------------------------------
// isAllowedPair
// ---------------------------------------------------------------------------

describe('ConnectionCompatibility – isAllowedPair', () => {

    const compat = new ConnectionCompatibility();

    it("stud ↔ anti-stud → 'full'", () => {
        assert.strictEqual(compat.isAllowedPair('stud', 'anti-stud'), 'full');
    });

    it("anti-stud ↔ stud → 'full' (reverse lookup)", () => {
        assert.strictEqual(compat.isAllowedPair('anti-stud', 'stud'), 'full');
    });

    it("gear ↔ gear → 'partial'", () => {
        assert.strictEqual(compat.isAllowedPair('gear', 'gear'), 'partial');
    });

    it("stud ↔ clip → 'none'", () => {
        assert.strictEqual(compat.isAllowedPair('stud', 'clip'), 'none');
    });

    it("hinge-male ↔ hinge-female → 'full'", () => {
        assert.strictEqual(compat.isAllowedPair('hinge-male', 'hinge-female'), 'full');
    });

    it("technic-hole ↔ technic-hole → 'full' (pin fits both ends)", () => {
        assert.strictEqual(compat.isAllowedPair('technic-hole', 'technic-hole'), 'full');
    });

    it("axle-hole ↔ technic-hole → 'partial'", () => {
        assert.strictEqual(compat.isAllowedPair('axle-hole', 'technic-hole'), 'partial');
    });

    it("returns 'none' for non-string arguments", () => {
        assert.strictEqual(compat.isAllowedPair(null, 'stud'),  'none');
        assert.strictEqual(compat.isAllowedPair('stud', 42),   'none');
    });
});

// ---------------------------------------------------------------------------
// getCompatibleTypes
// ---------------------------------------------------------------------------

describe('ConnectionCompatibility – getCompatibleTypes', () => {

    const compat = new ConnectionCompatibility();

    it("getCompatibleTypes('stud') includes 'anti-stud'", () => {
        const result = compat.getCompatibleTypes('stud');
        assert.ok(Array.isArray(result));
        assert.ok(result.includes('anti-stud'), `expected anti-stud, got ${result}`);
    });

    it("getCompatibleTypes('clip') includes 'bar'", () => {
        const result = compat.getCompatibleTypes('clip');
        assert.ok(result.includes('bar'));
    });

    it("getCompatibleTypes('stud') does not include 'clip'", () => {
        const result = compat.getCompatibleTypes('stud');
        assert.ok(!result.includes('clip'));
    });

    it("getCompatibleTypes('gear') includes 'gear'", () => {
        const result = compat.getCompatibleTypes('gear');
        assert.ok(result.includes('gear'));
    });

    it("getCompatibleTypes for an unknown type returns an array (possibly empty)", () => {
        const result = compat.getCompatibleTypes('banana');
        assert.ok(Array.isArray(result));
    });
});

// ---------------------------------------------------------------------------
// checkDirections
// ---------------------------------------------------------------------------

describe('ConnectionCompatibility – checkDirections', () => {

    const compat = new ConnectionCompatibility();

    it('anti-parallel vectors (up vs down) → true', () => {
        assert.strictEqual(compat.checkDirections(UP, DOWN), true);
    });

    it('parallel vectors (both up) → false', () => {
        assert.strictEqual(compat.checkDirections(UP, UP), false);
    });

    it('perpendicular vectors → false', () => {
        const right   = { x: 1, y: 0, z: 0 };
        assert.strictEqual(compat.checkDirections(UP, right), false);
    });

    it('nearly anti-parallel within default tolerance → true', () => {
        // 3° off anti-parallel  (dot ≈ cos(177°) ≈ −0.9986)
        const tiltRad = (3 * Math.PI) / 180;
        const nearlyDown = {
            x: Math.sin(tiltRad),
            y: -Math.cos(tiltRad),
            z: 0,
        };
        assert.strictEqual(compat.checkDirections(UP, nearlyDown), true);
    });

    it('overriding toleranceDeg to 0 is stricter', () => {
        // 3° off – should fail when tolerance is 0°
        const tiltRad = (3 * Math.PI) / 180;
        const nearlyDown = { x: Math.sin(tiltRad), y: -Math.cos(tiltRad), z: 0 };
        assert.strictEqual(compat.checkDirections(UP, nearlyDown, 0), false);
    });

    it('custom tolerance of 10° accepts 8° off anti-parallel', () => {
        const tiltRad = (8 * Math.PI) / 180;
        const slightlyOff = { x: Math.sin(tiltRad), y: -Math.cos(tiltRad), z: 0 };
        assert.strictEqual(compat.checkDirections(UP, slightlyOff, 10), true);
    });
});

// ---------------------------------------------------------------------------
// check (full compatibility check)
// ---------------------------------------------------------------------------

describe('ConnectionCompatibility – check', () => {

    const compat = new ConnectionCompatibility();

    it('returns an object with compatible, confidence, and reason', () => {
        const result = compat.check(makePoint('stud', UP), makePoint('anti-stud', DOWN));
        assert.ok('compatible'  in result);
        assert.ok('confidence'  in result);
        assert.ok('reason'      in result);
    });

    it('compatible stud↔anti-stud with aligned directions → compatible:true', () => {
        const result = compat.check(makePoint('stud', UP), makePoint('anti-stud', DOWN));
        assert.strictEqual(result.compatible, true);
    });

    it('stud↔anti-stud full match → confidence is full', () => {
        const result = compat.check(makePoint('stud', UP), makePoint('anti-stud', DOWN));
        assert.strictEqual(result.confidence, 'full');
    });

    it('incompatible types → compatible:false', () => {
        const result = compat.check(makePoint('stud', UP), makePoint('technic-hole', DOWN));
        assert.strictEqual(result.compatible, false);
    });

    it('incompatible types → confidence is none', () => {
        const result = compat.check(makePoint('stud', UP), makePoint('technic-hole', DOWN));
        assert.strictEqual(result.confidence, 'none');
    });

    it('reason is a non-empty string', () => {
        const result = compat.check(makePoint('stud', UP), makePoint('anti-stud', DOWN));
        assert.strictEqual(typeof result.reason, 'string');
        assert.ok(result.reason.length > 0);
    });

    it('null pointA → compatible:false with reason', () => {
        const result = compat.check(null, makePoint('anti-stud', DOWN));
        assert.strictEqual(result.compatible, false);
        assert.ok(result.reason.length > 0);
    });

    it('null pointB → compatible:false with reason', () => {
        const result = compat.check(makePoint('stud', UP), null);
        assert.strictEqual(result.compatible, false);
    });

    it('direction mismatch (parallel instead of anti-parallel) → compatible:false', () => {
        // Both pointing UP — same direction, not anti-parallel
        const result = compat.check(makePoint('stud', UP), makePoint('anti-stud', UP));
        assert.strictEqual(result.compatible, false);
    });

    it('gear ↔ gear with anti-parallel directions → compatible:true, confidence:partial', () => {
        const result = compat.check(makePoint('gear', UP), makePoint('gear', DOWN));
        assert.strictEqual(result.compatible, true);
        assert.strictEqual(result.confidence, 'partial');
    });

    it('clip ↔ bar with anti-parallel directions → compatible:true', () => {
        const result = compat.check(makePoint('clip', UP), makePoint('bar', DOWN));
        assert.strictEqual(result.compatible, true);
    });

    it('constructor respects custom tolerances', () => {
        const strict = new ConnectionCompatibility({ tolerances: { angle: 0, distance: 0 } });
        // 3° off anti-parallel should fail with 0° tolerance
        const tiltRad = (3 * Math.PI) / 180;
        const nearlyDown = { x: Math.sin(tiltRad), y: -Math.cos(tiltRad), z: 0 };
        const result = strict.check(makePoint('stud', UP), makePoint('anti-stud', nearlyDown));
        assert.strictEqual(result.compatible, false);
    });
});
