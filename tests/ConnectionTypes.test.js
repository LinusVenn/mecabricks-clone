/**
 * ConnectionTypes.test.js
 *
 * Tests for src/connections/ConnectionTypes.js
 * Runner: node:test  +  node:assert/strict  (ESM)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    CONNECTION_TYPES,
    CONNECTION_TYPE_LIST,
    isValidConnectionType,
    getLegacyType,
} from '../src/connections/ConnectionTypes.js';

// ---------------------------------------------------------------------------
// CONNECTION_TYPES object
// ---------------------------------------------------------------------------

describe('CONNECTION_TYPES', () => {

    it('is frozen (immutable)', () => {
        assert.ok(Object.isFrozen(CONNECTION_TYPES));
    });

    it('has exactly 13 keys', () => {
        assert.strictEqual(Object.keys(CONNECTION_TYPES).length, 13);
    });

    it('contains all expected keys', () => {
        const expectedKeys = [
            'STUD', 'ANTI_STUD', 'TECHNIC_HOLE', 'AXLE_HOLE', 'PIN_HOLE',
            'CLIP', 'BAR', 'HINGE_MALE', 'HINGE_FEMALE',
            'BALL', 'BALL_SOCKET', 'GEAR', 'STUD_TO_BOTTOM',
        ];
        for (const key of expectedKeys) {
            assert.ok(key in CONNECTION_TYPES, `missing key: ${key}`);
        }
    });

    it('has the expected string values', () => {
        assert.strictEqual(CONNECTION_TYPES.STUD,          'stud');
        assert.strictEqual(CONNECTION_TYPES.ANTI_STUD,     'anti-stud');
        assert.strictEqual(CONNECTION_TYPES.TECHNIC_HOLE,  'technic-hole');
        assert.strictEqual(CONNECTION_TYPES.AXLE_HOLE,     'axle-hole');
        assert.strictEqual(CONNECTION_TYPES.PIN_HOLE,      'pin-hole');
        assert.strictEqual(CONNECTION_TYPES.CLIP,          'clip');
        assert.strictEqual(CONNECTION_TYPES.BAR,           'bar');
        assert.strictEqual(CONNECTION_TYPES.HINGE_MALE,    'hinge-male');
        assert.strictEqual(CONNECTION_TYPES.HINGE_FEMALE,  'hinge-female');
        assert.strictEqual(CONNECTION_TYPES.BALL,          'ball');
        assert.strictEqual(CONNECTION_TYPES.BALL_SOCKET,   'ball-socket');
        assert.strictEqual(CONNECTION_TYPES.GEAR,          'gear');
        assert.strictEqual(CONNECTION_TYPES.STUD_TO_BOTTOM,'stud-to-bottom');
    });

    it('cannot be mutated (assigning throws in strict-mode or silently fails)', () => {
        // Object.freeze prevents writes; in strict mode it would throw.
        // We test that the value is unchanged after an attempted assignment.
        try { CONNECTION_TYPES.STUD = 'mutated'; } catch (_) { /* expected */ }
        assert.strictEqual(CONNECTION_TYPES.STUD, 'stud');
    });
});

// ---------------------------------------------------------------------------
// isValidConnectionType
// ---------------------------------------------------------------------------

describe('isValidConnectionType', () => {

    it("returns true for 'stud'", () => {
        assert.strictEqual(isValidConnectionType('stud'), true);
    });

    it("returns true for 'anti-stud'", () => {
        assert.strictEqual(isValidConnectionType('anti-stud'), true);
    });

    it("returns true for 'stud-to-bottom' (legacy alias)", () => {
        assert.strictEqual(isValidConnectionType('stud-to-bottom'), true);
    });

    it("returns true for all values in CONNECTION_TYPES", () => {
        for (const v of Object.values(CONNECTION_TYPES)) {
            assert.strictEqual(isValidConnectionType(v), true, `should be valid: ${v}`);
        }
    });

    it("returns false for 'invalid'", () => {
        assert.strictEqual(isValidConnectionType('invalid'), false);
    });

    it("returns false for empty string", () => {
        assert.strictEqual(isValidConnectionType(''), false);
    });

    it("returns false for null", () => {
        assert.strictEqual(isValidConnectionType(null), false);
    });

    it("returns false for undefined", () => {
        assert.strictEqual(isValidConnectionType(undefined), false);
    });

    it("returns false for a number", () => {
        assert.strictEqual(isValidConnectionType(42), false);
    });
});

// ---------------------------------------------------------------------------
// getLegacyType
// ---------------------------------------------------------------------------

describe('getLegacyType', () => {

    it("'stud-to-bottom' resolves to ['stud', 'anti-stud']", () => {
        const result = getLegacyType('stud-to-bottom');
        assert.deepEqual([...result], ['stud', 'anti-stud']);
    });

    it("result for 'stud-to-bottom' is frozen / readonly", () => {
        const result = getLegacyType('stud-to-bottom');
        assert.ok(Object.isFrozen(result));
    });

    it("'stud' returns an empty array (not a legacy alias)", () => {
        const result = getLegacyType('stud');
        assert.strictEqual(result.length, 0);
    });

    it("unknown string returns an empty array", () => {
        const result = getLegacyType('banana');
        assert.strictEqual(result.length, 0);
    });

    it("return value is always iterable (safe for callers)", () => {
        const result = getLegacyType('nonexistent');
        assert.doesNotThrow(() => { for (const _ of result) {} });
    });
});

// ---------------------------------------------------------------------------
// CONNECTION_TYPE_LIST
// ---------------------------------------------------------------------------

describe('CONNECTION_TYPE_LIST', () => {

    it('is a non-empty array', () => {
        assert.ok(Array.isArray(CONNECTION_TYPE_LIST));
        assert.ok(CONNECTION_TYPE_LIST.length > 0);
    });

    it('is frozen', () => {
        assert.ok(Object.isFrozen(CONNECTION_TYPE_LIST));
    });

    it('contains all CONNECTION_TYPES values', () => {
        for (const v of Object.values(CONNECTION_TYPES)) {
            assert.ok(
                CONNECTION_TYPE_LIST.includes(v),
                `CONNECTION_TYPE_LIST is missing: ${v}`
            );
        }
    });

    it('every entry passes isValidConnectionType', () => {
        for (const t of CONNECTION_TYPE_LIST) {
            assert.strictEqual(
                isValidConnectionType(t), true,
                `should pass validation: ${t}`
            );
        }
    });

    it('is sorted alphabetically', () => {
        const sorted = [...CONNECTION_TYPE_LIST].sort();
        assert.deepEqual([...CONNECTION_TYPE_LIST], sorted);
    });
});
