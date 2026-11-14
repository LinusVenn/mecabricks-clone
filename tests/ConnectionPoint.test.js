/**
 * ConnectionPoint.test.js
 *
 * Tests for src/connections/ConnectionPoint.js
 * Runner: node:test  +  node:assert/strict  (ESM)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ConnectionPoint } from '../src/connections/ConnectionPoint.js';
import { CONNECTION_TYPES } from '../src/connections/ConnectionTypes.js';

// ---------------------------------------------------------------------------
// Minimal valid definition helpers
// ---------------------------------------------------------------------------

const STUD_DEF = Object.freeze({
    id:            'test-part_stud_0_0',
    partId:        'test-part',
    type:          'stud',
    localPosition: { x: 0, y: 1.2, z: 0 },
    direction:     { x: 0, y: 1, z: 0 },
});

const ANTI_STUD_DEF = Object.freeze({
    id:            'test-part_antistud_0_0',
    partId:        'test-part',
    type:          'anti-stud',
    localPosition: { x: 0, y: 0, z: 0 },
    direction:     { x: 0, y: -1, z: 0 },
});

const TECHNIC_DEF = Object.freeze({
    id:            'test-part_technic_0',
    partId:        'test-part',
    type:          'technic-hole',
    localPosition: { x: 0, y: 0.6, z: 0 },
    direction:     { x: 0, y: 0, z: 1 },
});

function makeStud(overrides = {}) {
    return new ConnectionPoint({ ...STUD_DEF, ...overrides });
}

function makeAntiStud(overrides = {}) {
    return new ConnectionPoint({ ...ANTI_STUD_DEF, ...overrides });
}

function makeTechnic(overrides = {}) {
    return new ConnectionPoint({ ...TECHNIC_DEF, ...overrides });
}

// ---------------------------------------------------------------------------
// Constructor & basic field checks
// ---------------------------------------------------------------------------

describe('ConnectionPoint – constructor', () => {

    it('creates an instance without throwing for valid definition', () => {
        assert.doesNotThrow(() => makeStud());
    });

    it('is an instance of ConnectionPoint', () => {
        assert.ok(makeStud() instanceof ConnectionPoint);
    });

    it('accepts all supported connection types without throwing', () => {
        const supportedTypes = [
            'stud', 'anti-stud', 'technic-hole', 'axle-hole', 'pin-hole',
            'clip', 'bar', 'hinge-male', 'hinge-female', 'ball', 'ball-socket',
            'gear', 'stud-to-bottom',
        ];
        for (const type of supportedTypes) {
            assert.doesNotThrow(
                () => makeStud({ type, id: `x_${type}` }),
                `should accept type: ${type}`
            );
        }
    });

    it('throws TypeError when id is missing', () => {
        const def = { ...STUD_DEF };
        delete def.id;
        assert.throws(() => new ConnectionPoint(def), TypeError);
    });

    it('throws TypeError when id is an empty string', () => {
        assert.throws(() => makeStud({ id: '' }), TypeError);
    });

    it('throws TypeError when partId is missing', () => {
        const def = { ...STUD_DEF };
        delete def.partId;
        assert.throws(() => new ConnectionPoint(def), TypeError);
    });

    it('throws TypeError when partId is an empty string', () => {
        assert.throws(() => makeStud({ partId: '' }), TypeError);
    });

    it('throws RangeError for an unknown connection type', () => {
        assert.throws(() => makeStud({ type: 'banana-peel' }), RangeError);
    });

    it('throws TypeError when called with no argument', () => {
        assert.throws(() => new ConnectionPoint(), TypeError);
    });

    it('throws TypeError when localPosition is missing', () => {
        const def = { ...STUD_DEF };
        delete def.localPosition;
        assert.throws(() => new ConnectionPoint(def), TypeError);
    });

    it('throws TypeError when direction is missing', () => {
        const def = { ...STUD_DEF };
        delete def.direction;
        assert.throws(() => new ConnectionPoint(def), TypeError);
    });
});

// ---------------------------------------------------------------------------
// Getters
// ---------------------------------------------------------------------------

describe('ConnectionPoint – getters', () => {

    it('id getter returns the provided id', () => {
        assert.strictEqual(makeStud().id, STUD_DEF.id);
    });

    it('partId getter returns the provided partId', () => {
        assert.strictEqual(makeStud().partId, STUD_DEF.partId);
    });

    it('type getter returns the connection type string', () => {
        assert.strictEqual(makeStud().type, 'stud');
        assert.strictEqual(makeAntiStud().type, 'anti-stud');
    });

    it('localPosition getter returns the position object', () => {
        const cp = makeStud();
        assert.strictEqual(cp.localPosition.x, 0);
        assert.strictEqual(cp.localPosition.y, 1.2);
        assert.strictEqual(cp.localPosition.z, 0);
    });

    it('localPosition is frozen', () => {
        assert.ok(Object.isFrozen(makeStud().localPosition));
    });

    it('direction getter returns a normalised unit vector', () => {
        const cp = makeStud();
        const len = Math.sqrt(
            cp.direction.x ** 2 + cp.direction.y ** 2 + cp.direction.z ** 2
        );
        assert.ok(Math.abs(len - 1) < 1e-6, `direction should be unit length, got ${len}`);
    });

    it('direction is frozen', () => {
        assert.ok(Object.isFrozen(makeStud().direction));
    });

    it('properties getter returns an empty object when not provided', () => {
        const cp = makeStud();
        assert.deepEqual(cp.properties, {});
    });

    it('properties getter returns provided properties', () => {
        const cp = makeStud({ properties: { color: 'red', size: 1 } });
        assert.strictEqual(cp.properties.color, 'red');
        assert.strictEqual(cp.properties.size, 1);
    });

    it('properties is frozen', () => {
        const cp = makeStud({ properties: { foo: 'bar' } });
        assert.ok(Object.isFrozen(cp.properties));
    });
});

// ---------------------------------------------------------------------------
// Type-query methods
// ---------------------------------------------------------------------------

describe('ConnectionPoint – type queries', () => {

    it('isStud() returns true for stud type', () => {
        assert.strictEqual(makeStud().isStud(), true);
    });

    it('isStud() returns false for anti-stud type', () => {
        assert.strictEqual(makeAntiStud().isStud(), false);
    });

    it('isAntiStud() returns true for anti-stud type', () => {
        assert.strictEqual(makeAntiStud().isAntiStud(), true);
    });

    it('isAntiStud() returns false for stud type', () => {
        assert.strictEqual(makeStud().isAntiStud(), false);
    });

    it('isTechnic() returns true for technic-hole', () => {
        assert.strictEqual(makeTechnic().isTechnic(), true);
    });

    it('isTechnic() returns true for axle-hole', () => {
        const cp = makeStud({ id: 'x', type: 'axle-hole' });
        assert.strictEqual(cp.isTechnic(), true);
    });

    it('isTechnic() returns true for pin-hole', () => {
        const cp = makeStud({ id: 'x', type: 'pin-hole' });
        assert.strictEqual(cp.isTechnic(), true);
    });

    it('isTechnic() returns false for stud', () => {
        assert.strictEqual(makeStud().isTechnic(), false);
    });
});

// ---------------------------------------------------------------------------
// worldPosition
// ---------------------------------------------------------------------------

describe('ConnectionPoint – worldPosition', () => {

    it('with zero rotation translates local position by part position', () => {
        const cp = makeStud(); // localPosition { x:0, y:1.2, z:0 }
        const world = cp.worldPosition({
            position: { x: 10, y: 0, z: 5 },
            rotation: { x: 0, y: 0, z: 0 },
        });
        assert.ok(Math.abs(world.x - 10) < 1e-6);
        assert.ok(Math.abs(world.y - 1.2) < 1e-6);
        assert.ok(Math.abs(world.z - 5)   < 1e-6);
    });

    it('with zero rotation and non-zero localPosition adds correctly', () => {
        const cp = new ConnectionPoint({
            id: 'p', partId: 'part', type: 'stud',
            localPosition: { x: 2, y: 1, z: 3 },
            direction: { x: 0, y: 1, z: 0 },
        });
        const world = cp.worldPosition({
            position: { x: 1, y: 1, z: 1 },
            rotation: { x: 0, y: 0, z: 0 },
        });
        assert.ok(Math.abs(world.x - 3) < 1e-6);
        assert.ok(Math.abs(world.y - 2) < 1e-6);
        assert.ok(Math.abs(world.z - 4) < 1e-6);
    });

    it('Y-rotation of 90° rotates X→Z correctly (x=1,y=0,z=0 → x≈0,z≈-1)', () => {
        const cp = new ConnectionPoint({
            id: 'p', partId: 'part', type: 'stud',
            localPosition: { x: 1, y: 0, z: 0 },
            direction: { x: 0, y: 1, z: 0 },
        });
        const world = cp.worldPosition({
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: Math.PI / 2, z: 0 },
        });
        // After +90° Y rotation: x=1 → z=-1, z=0 → x=0
        assert.ok(Math.abs(world.x - 0) < 1e-6,  `x should ≈ 0, got ${world.x}`);
        assert.ok(Math.abs(world.y - 0) < 1e-6,  `y should ≈ 0, got ${world.y}`);
        assert.ok(Math.abs(world.z - (-1)) < 1e-6, `z should ≈ -1, got ${world.z}`);
    });

    it('omitting rotation defaults to zero rotation', () => {
        const cp = makeStud(); // localPosition {x:0, y:1.2, z:0}
        const withZero    = cp.worldPosition({ position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } });
        const withDefault = cp.worldPosition({ position: { x:0, y:0, z:0 } });
        assert.ok(Math.abs(withZero.x - withDefault.x) < 1e-9);
        assert.ok(Math.abs(withZero.y - withDefault.y) < 1e-9);
        assert.ok(Math.abs(withZero.z - withDefault.z) < 1e-9);
    });
});

// ---------------------------------------------------------------------------
// isCompatibleWith
// ---------------------------------------------------------------------------

describe('ConnectionPoint – isCompatibleWith', () => {

    it('stud ↔ anti-stud returns true', () => {
        const stud     = makeStud();
        const antiStud = makeAntiStud();
        assert.strictEqual(stud.isCompatibleWith(antiStud), true);
    });

    it('anti-stud ↔ stud returns true (symmetric)', () => {
        const stud     = makeStud();
        const antiStud = makeAntiStud();
        assert.strictEqual(antiStud.isCompatibleWith(stud), true);
    });

    it('stud ↔ technic-hole returns false', () => {
        const stud    = makeStud();
        const technic = makeTechnic();
        assert.strictEqual(stud.isCompatibleWith(technic), false);
    });

    it('stud ↔ stud returns false (same type)', () => {
        const a = makeStud();
        const b = makeStud({ id: 'test-part_stud_0_1' });
        assert.strictEqual(a.isCompatibleWith(b), false);
    });

    it('returns false when argument is not a ConnectionPoint', () => {
        assert.strictEqual(makeStud().isCompatibleWith(null), false);
        assert.strictEqual(makeStud().isCompatibleWith({ type: 'anti-stud' }), false);
    });

    it('clip ↔ bar returns true', () => {
        const clip = makeStud({ id: 'x_clip', type: 'clip' });
        const bar  = makeStud({ id: 'x_bar',  type: 'bar'  });
        assert.strictEqual(clip.isCompatibleWith(bar), true);
    });

    it('hinge-male ↔ hinge-female returns true', () => {
        const hm = makeStud({ id: 'x_hm', type: 'hinge-male'   });
        const hf = makeStud({ id: 'x_hf', type: 'hinge-female' });
        assert.strictEqual(hm.isCompatibleWith(hf), true);
    });
});

// ---------------------------------------------------------------------------
// toData / fromData roundtrip
// ---------------------------------------------------------------------------

describe('ConnectionPoint – toData / fromData', () => {

    it('toData returns a plain object', () => {
        const data = makeStud().toData();
        assert.strictEqual(typeof data, 'object');
        assert.ok(!(data instanceof ConnectionPoint));
    });

    it('toData includes all required fields', () => {
        const data = makeStud().toData();
        assert.ok('id'            in data);
        assert.ok('partId'        in data);
        assert.ok('type'          in data);
        assert.ok('localPosition' in data);
        assert.ok('direction'     in data);
        assert.ok('properties'    in data);
    });

    it('fromData recreates an equivalent ConnectionPoint', () => {
        const original  = makeStud({ properties: { meta: 42 } });
        const roundtrip = ConnectionPoint.fromData(original.toData());

        assert.strictEqual(roundtrip.id,     original.id);
        assert.strictEqual(roundtrip.partId, original.partId);
        assert.strictEqual(roundtrip.type,   original.type);
        assert.deepEqual(roundtrip.localPosition, original.localPosition);
        assert.deepEqual(roundtrip.properties,    original.properties);
    });

    it('fromData result is a proper ConnectionPoint instance', () => {
        const roundtrip = ConnectionPoint.fromData(makeStud().toData());
        assert.ok(roundtrip instanceof ConnectionPoint);
    });

    it('direction in toData output is a normalised unit vector', () => {
        const data = makeStud().toData();
        const len  = Math.sqrt(data.direction.x ** 2 + data.direction.y ** 2 + data.direction.z ** 2);
        assert.ok(Math.abs(len - 1) < 1e-6);
    });
});
