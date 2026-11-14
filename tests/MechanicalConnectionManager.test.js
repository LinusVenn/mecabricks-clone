/**
 * tests/MechanicalConnectionManager.test.js
 *
 * Phase F – MechanicalConnection & MechanicalConnectionManager
 * ~55 assertions
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    MECHANICAL_CONNECTION_TYPES,
    MechanicalConnection,
    MechanicalConnectionManager,
} from '../src/connections/MechanicalConnectionManager.js';

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const RIGID_DEF = {
    type:  'rigid',
    partA: 'instance-001',
    partB: 'instance-002',
};

const REVOLUTE_WITH_AXIS = {
    type:  'revolute',
    partA: 'instance-001',
    partB: 'instance-002',
    axis:  { x: 0, y: 1, z: 0 },
    anchor: { x: 1, y: 2, z: 3 },
};

// ---------------------------------------------------------------------------
// MECHANICAL_CONNECTION_TYPES
// ---------------------------------------------------------------------------

describe('MECHANICAL_CONNECTION_TYPES', () => {

    it('is a frozen object', () => {
        assert.ok(Object.isFrozen(MECHANICAL_CONNECTION_TYPES));
    });

    it('has exactly 6 types', () => {
        assert.strictEqual(Object.keys(MECHANICAL_CONNECTION_TYPES).length, 6);
    });

    it('contains RIGID  = "rigid"',     () => assert.strictEqual(MECHANICAL_CONNECTION_TYPES.RIGID,     'rigid'));
    it('contains REVOLUTE = "revolute"', () => assert.strictEqual(MECHANICAL_CONNECTION_TYPES.REVOLUTE,  'revolute'));
    it('contains PRISMATIC = "prismatic"', () => assert.strictEqual(MECHANICAL_CONNECTION_TYPES.PRISMATIC, 'prismatic'));
    it('contains BALL  = "ball"',       () => assert.strictEqual(MECHANICAL_CONNECTION_TYPES.BALL,      'ball'));
    it('contains GEAR  = "gear"',       () => assert.strictEqual(MECHANICAL_CONNECTION_TYPES.GEAR,      'gear'));
    it('contains AXLE  = "axle"',       () => assert.strictEqual(MECHANICAL_CONNECTION_TYPES.AXLE,      'axle'));
});

// ---------------------------------------------------------------------------
// MechanicalConnection – constructor
// ---------------------------------------------------------------------------

describe('MechanicalConnection constructor', () => {

    it('creates with required fields (type, partA, partB)', () => {
        const conn = new MechanicalConnection(RIGID_DEF);
        assert.ok(conn instanceof MechanicalConnection);
    });

    it('auto-generates an id when none is provided', () => {
        const conn = new MechanicalConnection(RIGID_DEF);
        assert.ok(typeof conn.id === 'string' && conn.id.length > 0);
        assert.ok(conn.id.startsWith('mconn-'));
    });

    it('preserves a caller-supplied id', () => {
        const conn = new MechanicalConnection({ ...RIGID_DEF, id: 'my-id-42' });
        assert.strictEqual(conn.id, 'my-id-42');
    });

    it('throws TypeError when def is null', () => {
        assert.throws(() => new MechanicalConnection(null), TypeError);
    });

    it('throws TypeError for an unknown type', () => {
        assert.throws(
            () => new MechanicalConnection({ type: 'unknown', partA: 'a', partB: 'b' }),
            TypeError
        );
    });

    it('throws TypeError when partA is missing', () => {
        assert.throws(
            () => new MechanicalConnection({ type: 'rigid', partB: 'b' }),
            TypeError
        );
    });

    it('throws TypeError when partA === partB', () => {
        assert.throws(
            () => new MechanicalConnection({ type: 'rigid', partA: 'x', partB: 'x' }),
            TypeError
        );
    });

    it('throws TypeError for non-vector axis', () => {
        assert.throws(
            () => new MechanicalConnection({ ...RIGID_DEF, axis: { x: 'bad', y: 1, z: 0 } }),
            TypeError
        );
    });

    it('throws TypeError for limits with NaN min', () => {
        assert.throws(
            () => new MechanicalConnection({ ...RIGID_DEF, limits: { min: NaN, max: 45 } }),
            TypeError
        );
    });

    it('throws RangeError when limits.min > limits.max', () => {
        assert.throws(
            () => new MechanicalConnection({ ...RIGID_DEF, limits: { min: 90, max: 0 } }),
            RangeError
        );
    });
});

// ---------------------------------------------------------------------------
// MechanicalConnection – getters
// ---------------------------------------------------------------------------

describe('MechanicalConnection getters', () => {

    let conn;
    beforeEach(() => {
        conn = new MechanicalConnection({
            id:               'test-id',
            type:             'revolute',
            partA:            'pA',
            partB:            'pB',
            connectionPointA: 'cpA',
            connectionPointB: 'cpB',
            anchor:           { x: 1, y: 2, z: 3 },
            axis:             { x: 0, y: 1, z: 0 },
            limits:           { min: -90, max: 90 },
        });
    });

    it('id getter',               () => assert.strictEqual(conn.id,               'test-id'));
    it('type getter',             () => assert.strictEqual(conn.type,             'revolute'));
    it('partA getter',            () => assert.strictEqual(conn.partA,            'pA'));
    it('partB getter',            () => assert.strictEqual(conn.partB,            'pB'));
    it('connectionPointA getter', () => assert.strictEqual(conn.connectionPointA, 'cpA'));
    it('connectionPointB getter', () => assert.strictEqual(conn.connectionPointB, 'cpB'));

    it('anchor getter returns a fresh copy', () => {
        const a = conn.anchor;
        assert.deepEqual(a, { x: 1, y: 2, z: 3 });
        // Mutating the returned copy must not change the stored value
        a.x = 999;
        assert.strictEqual(conn.anchor.x, 1);
    });

    it('axis getter returns a fresh copy', () => {
        const ax = conn.axis;
        assert.ok(ax !== null);
        ax.y = 999;
        assert.notStrictEqual(conn.axis.y, 999);
    });

    it('limits getter returns a fresh copy', () => {
        const lim = conn.limits;
        assert.deepEqual(lim, { min: -90, max: 90 });
        lim.min = 0;
        assert.strictEqual(conn.limits.min, -90);
    });
});

// ---------------------------------------------------------------------------
// isMovable()
// ---------------------------------------------------------------------------

describe('MechanicalConnection.isMovable()', () => {

    it('returns false for "rigid"', () => {
        const c = new MechanicalConnection(RIGID_DEF);
        assert.strictEqual(c.isMovable(), false);
    });

    it('returns true for "revolute"', () => {
        const c = new MechanicalConnection({ type: 'revolute', partA: 'a', partB: 'b' });
        assert.strictEqual(c.isMovable(), true);
    });

    it('returns true for "prismatic"', () => {
        const c = new MechanicalConnection({ type: 'prismatic', partA: 'a', partB: 'b' });
        assert.strictEqual(c.isMovable(), true);
    });

    it('returns true for "ball"', () => {
        const c = new MechanicalConnection({ type: 'ball', partA: 'a', partB: 'b' });
        assert.strictEqual(c.isMovable(), true);
    });
});

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

describe('MechanicalConnection.validate()', () => {

    it('rigid with no extras → { valid: true, errors: [] }', () => {
        const res = new MechanicalConnection(RIGID_DEF).validate();
        assert.strictEqual(res.valid, true);
        assert.strictEqual(res.errors.length, 0);
    });

    it('revolute with axis → valid', () => {
        const res = new MechanicalConnection(REVOLUTE_WITH_AXIS).validate();
        assert.strictEqual(res.valid, true);
    });

    it('revolute WITHOUT axis → { valid: false, errors: [1 msg about axis] }', () => {
        const c = new MechanicalConnection({ type: 'revolute', partA: 'a', partB: 'b' });
        const res = c.validate();
        assert.strictEqual(res.valid, false);
        assert.ok(res.errors.length >= 1);
        assert.ok(res.errors[0].includes('axis'));
    });

    it('prismatic without axis → invalid', () => {
        const res = new MechanicalConnection({ type: 'prismatic', partA: 'a', partB: 'b' }).validate();
        assert.strictEqual(res.valid, false);
    });

    it('rigid with limits → warns about meaningless limits', () => {
        const c = new MechanicalConnection({ ...RIGID_DEF, limits: { min: 0, max: 10 } });
        const res = c.validate();
        assert.strictEqual(res.valid, false);
        assert.ok(res.errors.some(e => e.includes('limits')));
    });
});

// ---------------------------------------------------------------------------
// toData() / fromData() roundtrip
// ---------------------------------------------------------------------------

describe('MechanicalConnection serialization roundtrip', () => {

    it('toData() returns a plain object with all expected keys', () => {
        const conn = new MechanicalConnection({ ...REVOLUTE_WITH_AXIS, id: 'rt-1', limits: { min: -45, max: 45 } });
        const data = conn.toData();
        assert.ok(typeof data === 'object' && data !== null);
        assert.ok('id'   in data);
        assert.ok('type' in data);
        assert.ok('partA' in data);
        assert.ok('partB' in data);
        assert.ok('axis'  in data);
        assert.ok('anchor' in data);
        assert.ok('limits' in data);
        assert.ok('gearRatio' in data);
    });

    it('fromData() reconstructs correctly', () => {
        const original = new MechanicalConnection({ ...REVOLUTE_WITH_AXIS, id: 'rt-2' });
        const clone    = MechanicalConnection.fromData(original.toData());

        assert.strictEqual(clone.id,    original.id);
        assert.strictEqual(clone.type,  original.type);
        assert.strictEqual(clone.partA, original.partA);
        assert.strictEqual(clone.partB, original.partB);
        assert.deepEqual(clone.axis,   original.axis);
        assert.deepEqual(clone.anchor, original.anchor);
    });

    it('fromData() throws on non-object input', () => {
        assert.throws(() => MechanicalConnection.fromData(null),  TypeError);
        assert.throws(() => MechanicalConnection.fromData('str'), TypeError);
    });
});

// ---------------------------------------------------------------------------
// MechanicalConnectionManager
// ---------------------------------------------------------------------------

describe('MechanicalConnectionManager', () => {

    let mgr;

    beforeEach(() => {
        mgr = new MechanicalConnectionManager();
    });

    // addConnection -----------------------------------------------------------

    describe('addConnection()', () => {

        it('returns a MechanicalConnection', () => {
            const c = mgr.addConnection(RIGID_DEF);
            assert.ok(c instanceof MechanicalConnection);
        });

        it('stores the connection so getCount() increases', () => {
            mgr.addConnection(RIGID_DEF);
            assert.strictEqual(mgr.getCount(), 1);
        });

        it('throws TypeError when partA is missing', () => {
            assert.throws(
                () => mgr.addConnection({ type: 'rigid', partB: 'b' }),
                TypeError
            );
        });

        it('throws if the same id is registered twice', () => {
            mgr.addConnection({ ...RIGID_DEF, id: 'dup-id' });
            assert.throws(
                () => mgr.addConnection({ ...RIGID_DEF, id: 'dup-id' }),
                /already exists/
            );
        });
    });

    // getConnection -----------------------------------------------------------

    describe('getConnection()', () => {

        it('returns the connection for a known id', () => {
            const c = mgr.addConnection({ ...RIGID_DEF, id: 'known-1' });
            assert.strictEqual(mgr.getConnection('known-1'), c);
        });

        it('returns null for an unknown id', () => {
            assert.strictEqual(mgr.getConnection('no-such-id'), null);
        });
    });

    // getConnectionsForPart ---------------------------------------------------

    describe('getConnectionsForPart()', () => {

        it('returns connections where the instance is partA', () => {
            mgr.addConnection({ type: 'rigid', partA: 'instance-001', partB: 'instance-002' });
            const res = mgr.getConnectionsForPart('instance-001');
            assert.strictEqual(res.length, 1);
        });

        it('returns connections where the instance is partB', () => {
            mgr.addConnection({ type: 'rigid', partA: 'instance-002', partB: 'instance-001' });
            const res = mgr.getConnectionsForPart('instance-001');
            assert.strictEqual(res.length, 1);
        });

        it('returns empty array when no connections match', () => {
            mgr.addConnection(RIGID_DEF);
            const res = mgr.getConnectionsForPart('unknown-inst');
            assert.strictEqual(res.length, 0);
        });

        it('returns all connections involving the instance across multiple entries', () => {
            mgr.addConnection({ type: 'rigid',    partA: 'instance-001', partB: 'inst-X' });
            mgr.addConnection({ type: 'revolute', partA: 'inst-Y',       partB: 'instance-001', axis: { x:0, y:1, z:0 } });
            mgr.addConnection({ type: 'rigid',    partA: 'inst-A',       partB: 'inst-B' }); // unrelated
            const res = mgr.getConnectionsForPart('instance-001');
            assert.strictEqual(res.length, 2);
        });
    });

    // removeConnection --------------------------------------------------------

    describe('removeConnection()', () => {

        it('returns true when the connection existed', () => {
            const c = mgr.addConnection({ ...RIGID_DEF, id: 'rem-1' });
            assert.strictEqual(mgr.removeConnection(c.id), true);
        });

        it('reduces count by one', () => {
            const c = mgr.addConnection({ ...RIGID_DEF, id: 'rem-2' });
            mgr.removeConnection(c.id);
            assert.strictEqual(mgr.getCount(), 0);
        });

        it('returns false for an unknown id', () => {
            assert.strictEqual(mgr.removeConnection('ghost-id'), false);
        });
    });

    // removeConnectionsForPart -----------------------------------------------

    describe('removeConnectionsForPart()', () => {

        it('removes all connections involving a part and returns the count', () => {
            mgr.addConnection({ type: 'rigid',    partA: 'instance-001', partB: 'X' });
            mgr.addConnection({ type: 'revolute', partA: 'Y',            partB: 'instance-001', axis: { x:0, y:1, z:0 } });
            mgr.addConnection({ type: 'rigid',    partA: 'A',            partB: 'B' }); // unrelated

            const removed = mgr.removeConnectionsForPart('instance-001');
            assert.strictEqual(removed, 2);
            assert.strictEqual(mgr.getCount(), 1); // only unrelated one remains
        });

        it('returns 0 when no connections match', () => {
            mgr.addConnection(RIGID_DEF);
            assert.strictEqual(mgr.removeConnectionsForPart('nobody'), 0);
        });
    });

    // hasConnectionBetween ----------------------------------------------------

    describe('hasConnectionBetween()', () => {

        beforeEach(() => {
            mgr.addConnection({ type: 'rigid', partA: 'inst-A', partB: 'inst-B' });
        });

        it('returns true for the stored direction (A→B)', () => {
            assert.strictEqual(mgr.hasConnectionBetween('inst-A', 'inst-B'), true);
        });

        it('returns true for the reverse direction (B→A)', () => {
            assert.strictEqual(mgr.hasConnectionBetween('inst-B', 'inst-A'), true);
        });

        it('returns false when no connection exists between the pair', () => {
            assert.strictEqual(mgr.hasConnectionBetween('inst-A', 'inst-C'), false);
        });
    });

    // getCount / clear --------------------------------------------------------

    describe('getCount() and clear()', () => {

        it('getCount() returns correct count', () => {
            mgr.addConnection({ type: 'rigid', partA: 'p1', partB: 'p2' });
            mgr.addConnection({ type: 'rigid', partA: 'p3', partB: 'p4' });
            assert.strictEqual(mgr.getCount(), 2);
        });

        it('clear() removes all connections', () => {
            mgr.addConnection(RIGID_DEF);
            mgr.clear();
            assert.strictEqual(mgr.getCount(), 0);
        });
    });

    // toData / loadFromData ---------------------------------------------------

    describe('toData()', () => {

        it('returns an object with a mechanicalConnections array', () => {
            mgr.addConnection({ ...RIGID_DEF, id: 'td-1' });
            const data = mgr.toData();
            assert.ok('mechanicalConnections' in data);
            assert.ok(Array.isArray(data.mechanicalConnections));
            assert.strictEqual(data.mechanicalConnections.length, 1);
            assert.strictEqual(data.mechanicalConnections[0].id, 'td-1');
        });
    });

    describe('loadFromData()', () => {

        it('loads valid entries and returns { loaded, skipped, errors }', () => {
            const data = {
                mechanicalConnections: [
                    { id: 'ld-1', type: 'rigid', partA: 'inst-A', partB: 'inst-B' }
                ]
            };
            const knownIds = new Set(['inst-A', 'inst-B']);
            const result = mgr.loadFromData(data, knownIds);
            assert.strictEqual(result.loaded, 1);
            assert.strictEqual(result.skipped, 0);
            assert.strictEqual(result.errors.length, 0);
            assert.ok(mgr.getConnection('ld-1') !== null);
        });

        it('skips duplicate ids and increments skipped', () => {
            mgr.addConnection({ ...RIGID_DEF, id: 'dup-load' });
            const data = {
                mechanicalConnections: [
                    { id: 'dup-load', type: 'rigid', partA: 'instance-001', partB: 'instance-002' }
                ]
            };
            const result = mgr.loadFromData(data, new Set());
            assert.strictEqual(result.skipped, 1);
            assert.strictEqual(result.loaded,  0);
        });

        it('skips invalid entries and records errors', () => {
            const data = {
                mechanicalConnections: [
                    { type: 'rigid', partA: 'a' }  // missing partB → TypeError
                ]
            };
            const result = mgr.loadFromData(data, new Set());
            assert.strictEqual(result.loaded,  0);
            assert.ok(result.skipped >= 1);
            assert.ok(result.errors.length >= 1);
        });

        it('returns an error when data.mechanicalConnections is not an array', () => {
            const result = mgr.loadFromData({}, new Set());
            assert.ok(result.errors.length >= 1);
        });

        it('skips entries whose partA is not a known instance id', () => {
            const data = {
                mechanicalConnections: [
                    { id: 'skip-1', type: 'rigid', partA: 'unknown-A', partB: 'inst-B' }
                ]
            };
            const knownIds = new Set(['inst-B']); // 'unknown-A' absent
            const result = mgr.loadFromData(data, knownIds);
            assert.ok(result.skipped >= 1 || result.errors.length >= 1);
        });
    });

    // Singleton ---------------------------------------------------------------

    describe('Singleton instance() / resetInstance()', () => {

        afterEach(() => {
            MechanicalConnectionManager.resetInstance();
        });

        it('instance() returns the same object on repeated calls', () => {
            const a = MechanicalConnectionManager.instance();
            const b = MechanicalConnectionManager.instance();
            assert.strictEqual(a, b);
        });

        it('resetInstance() causes instance() to return a fresh object', () => {
            const a = MechanicalConnectionManager.instance();
            MechanicalConnectionManager.resetInstance();
            const b = MechanicalConnectionManager.instance();
            assert.notStrictEqual(a, b);
        });
    });
});
