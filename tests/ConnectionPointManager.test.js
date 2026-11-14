/**
 * ConnectionPointManager.test.js
 *
 * Tests for src/connections/ConnectionPointManager.js
 * Runner: node:test  +  node:assert/strict  (ESM)
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ConnectionPointManager }              from '../src/connections/ConnectionPointManager.js';
import { ConnectionPoint }                     from '../src/connections/ConnectionPoint.js';
import { BUILTIN_CONNECTION_POINT_DEFINITIONS } from '../src/connections/ConnectionPointDefinitions.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal ConnectionPoint
// ---------------------------------------------------------------------------

function makeCP(overrides = {}) {
    return new ConnectionPoint({
        id:            'mock_stud_0_0',
        partId:        'mock-part',
        type:          'stud',
        localPosition: { x: 0, y: 1.2, z: 0 },
        direction:     { x: 0, y: 1, z: 0 },
        ...overrides,
    });
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

describe('ConnectionPointManager – singleton', () => {

    beforeEach(() => {
        ConnectionPointManager.resetInstance();
    });

    it('instance() returns a ConnectionPointManager', () => {
        const mgr = ConnectionPointManager.instance();
        assert.ok(mgr instanceof ConnectionPointManager);
    });

    it('instance() returns the same object on repeated calls', () => {
        const a = ConnectionPointManager.instance();
        const b = ConnectionPointManager.instance();
        assert.strictEqual(a, b);
    });

    it('resetInstance() causes the next instance() call to return a fresh object', () => {
        const before = ConnectionPointManager.instance();
        ConnectionPointManager.resetInstance();
        const after = ConnectionPointManager.instance();
        assert.notStrictEqual(before, after);
    });

    it('after resetInstance() a new instance has an empty registry', () => {
        const mgr = ConnectionPointManager.instance();
        mgr.registerPoints('some-part', [makeCP()]);
        ConnectionPointManager.resetInstance();
        const fresh = ConnectionPointManager.instance();
        assert.strictEqual(fresh.hasPoints('some-part'), false);
    });
});

// ---------------------------------------------------------------------------
// registerPoints
// ---------------------------------------------------------------------------

describe('ConnectionPointManager – registerPoints', () => {

    let mgr;
    beforeEach(() => {
        ConnectionPointManager.resetInstance();
        mgr = new ConnectionPointManager();
    });

    it('registers a valid array without throwing', () => {
        const cp = makeCP();
        assert.doesNotThrow(() => mgr.registerPoints('p1', [cp]));
    });

    it('registered points are retrievable via getPointsForPart', () => {
        const cp = makeCP({ id: 'p1_stud_0_0', partId: 'p1' });
        mgr.registerPoints('p1', [cp]);
        const result = mgr.getPointsForPart('p1');
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].id, 'p1_stud_0_0');
    });

    it('overwrites existing registration for the same partId', () => {
        const cp1 = makeCP({ id: 'p1_stud_0_0', partId: 'p1' });
        const cp2 = makeCP({ id: 'p1_stud_0_1', partId: 'p1' });
        mgr.registerPoints('p1', [cp1]);
        mgr.registerPoints('p1', [cp2]);
        const result = mgr.getPointsForPart('p1');
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].id, 'p1_stud_0_1');
    });

    it('throws TypeError if connectionPoints is not an array', () => {
        assert.throws(() => mgr.registerPoints('p1', 'not-an-array'), TypeError);
    });

    it('throws TypeError if an array element is not a ConnectionPoint', () => {
        assert.throws(() => mgr.registerPoints('p1', [{ type: 'stud' }]), TypeError);
    });

    it('registers multiple ConnectionPoints correctly', () => {
        const cp1 = makeCP({ id: 'p_s_0_0', partId: 'p' });
        const cp2 = makeCP({ id: 'p_s_0_1', partId: 'p', type: 'anti-stud',
                             direction: { x: 0, y: -1, z: 0 } });
        mgr.registerPoints('p', [cp1, cp2]);
        assert.strictEqual(mgr.getPointsForPart('p').length, 2);
    });
});

// ---------------------------------------------------------------------------
// hasPoints
// ---------------------------------------------------------------------------

describe('ConnectionPointManager – hasPoints', () => {

    let mgr;
    before(() => {
        ConnectionPointManager.resetInstance();
        mgr = new ConnectionPointManager();
        mgr.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
    });

    it("hasPoints('brick_2x4') returns true after loading builtins", () => {
        assert.strictEqual(mgr.hasPoints('brick_2x4'), true);
    });

    it("hasPoints('nonexistent') returns false", () => {
        assert.strictEqual(mgr.hasPoints('nonexistent'), false);
    });

    it("hasPoints('brick_1x1') returns true", () => {
        assert.strictEqual(mgr.hasPoints('brick_1x1'), true);
    });
});

// ---------------------------------------------------------------------------
// getPointsForPart
// ---------------------------------------------------------------------------

describe('ConnectionPointManager – getPointsForPart', () => {

    let mgr;
    before(() => {
        ConnectionPointManager.resetInstance();
        mgr = new ConnectionPointManager();
        mgr.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
    });

    it("getPointsForPart('brick_2x4') returns an array", () => {
        const pts = mgr.getPointsForPart('brick_2x4');
        assert.ok(Array.isArray(pts));
    });

    it("getPointsForPart('brick_2x4') returns ConnectionPoint instances", () => {
        const pts = mgr.getPointsForPart('brick_2x4');
        for (const p of pts) {
            assert.ok(p instanceof ConnectionPoint, 'each element should be a ConnectionPoint');
        }
    });

    it("getPointsForPart('brick_2x4') returns 16 points (4×2 studs + 4×2 anti-studs)", () => {
        const pts = mgr.getPointsForPart('brick_2x4');
        assert.strictEqual(pts.length, 16);
    });

    it("getPointsForPart('nonexistent') returns an empty array", () => {
        const pts = mgr.getPointsForPart('nonexistent');
        assert.deepEqual(pts, []);
    });
});

// ---------------------------------------------------------------------------
// getPointById
// ---------------------------------------------------------------------------

describe('ConnectionPointManager – getPointById', () => {

    let mgr;
    before(() => {
        ConnectionPointManager.resetInstance();
        mgr = new ConnectionPointManager();
        mgr.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
    });

    it("getPointById('brick_2x4', 'brick_2x4_stud_0_0') returns a ConnectionPoint", () => {
        const pt = mgr.getPointById('brick_2x4', 'brick_2x4_stud_0_0');
        assert.ok(pt instanceof ConnectionPoint);
        assert.strictEqual(pt.id, 'brick_2x4_stud_0_0');
    });

    it("getPointById returns null for an unknown point id", () => {
        const pt = mgr.getPointById('brick_2x4', 'nonexistent_id');
        assert.strictEqual(pt, null);
    });

    it("getPointById returns null for an unknown part", () => {
        const pt = mgr.getPointById('no-such-part', 'whatever');
        assert.strictEqual(pt, null);
    });
});

// ---------------------------------------------------------------------------
// autoGenerateForPart
// ---------------------------------------------------------------------------

describe('ConnectionPointManager – autoGenerateForPart', () => {

    let mgr;
    beforeEach(() => {
        ConnectionPointManager.resetInstance();
        mgr = new ConnectionPointManager();
    });

    it('generates stud + anti-stud points for a 2×2 brick', () => {
        const pts = mgr.autoGenerateForPart('test-part', {
            width: 2, depth: 2, height: 1.2, geometry: 'brick', studs: true,
        });
        assert.ok(Array.isArray(pts));
        assert.ok(pts.length > 0);
        const studs     = pts.filter(p => p.type === 'stud');
        const antiStuds = pts.filter(p => p.type === 'anti-stud');
        assert.strictEqual(studs.length,     4, 'should have 4 studs');
        assert.strictEqual(antiStuds.length, 4, 'should have 4 anti-studs');
    });

    it('every generated point is a ConnectionPoint instance', () => {
        const pts = mgr.autoGenerateForPart('test-part', {
            width: 2, depth: 2, height: 1.2, geometry: 'brick', studs: true,
        });
        for (const p of pts) {
            assert.ok(p instanceof ConnectionPoint);
        }
    });

    it('generated IDs follow the expected naming convention', () => {
        const pts = mgr.autoGenerateForPart('test-part', {
            width: 1, depth: 1, height: 1.2, geometry: 'brick', studs: true,
        });
        const ids = pts.map(p => p.id);
        assert.ok(ids.includes('test-part_stud_0_0'), `stud id missing, ids: ${ids}`);
    });

    it('generates only anti-studs for a tile geometry', () => {
        const pts = mgr.autoGenerateForPart('test-tile', {
            width: 2, depth: 2, height: 0.4, geometry: 'tile', studs: false,
        });
        const studs     = pts.filter(p => p.type === 'stud');
        const antiStuds = pts.filter(p => p.type === 'anti-stud');
        assert.strictEqual(studs.length, 0);
        assert.ok(antiStuds.length > 0);
    });

    it('generates technic-hole points for technic geometry', () => {
        const pts = mgr.autoGenerateForPart('test-technic', {
            width: 2, depth: 1, height: 1.2, geometry: 'technic', studs: false,
        });
        const technicHoles = pts.filter(p => p.type === 'technic-hole');
        assert.ok(technicHoles.length > 0);
    });

    it('returns an empty array for unknown geometry', () => {
        const pts = mgr.autoGenerateForPart('test-unknown', {
            width: 1, depth: 1, height: 1.2, geometry: 'magic-wand', studs: false,
        });
        assert.strictEqual(pts.length, 0);
    });
});

// ---------------------------------------------------------------------------
// loadBuiltinDefinitions
// ---------------------------------------------------------------------------

describe('ConnectionPointManager – loadBuiltinDefinitions', () => {

    let mgr;
    beforeEach(() => {
        ConnectionPointManager.resetInstance();
        mgr = new ConnectionPointManager();
    });

    it('returns a count > 0', () => {
        const count = mgr.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
        assert.ok(count > 0, `expected count > 0, got ${count}`);
    });

    it('returns exactly 426 total points', () => {
        const count = mgr.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
        assert.strictEqual(count, 426);
    });

    it('throws TypeError when called with null', () => {
        assert.throws(() => mgr.loadBuiltinDefinitions(null), TypeError);
    });

    it('after loading, getPointsForPart returns arrays for all 50 built-in parts', () => {
        mgr.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
        const partIds = Object.keys(BUILTIN_CONNECTION_POINT_DEFINITIONS);
        assert.strictEqual(partIds.length, 50);
        for (const id of partIds) {
            const pts = mgr.getPointsForPart(id);
            assert.ok(pts.length > 0, `no points for ${id}`);
        }
    });
});

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

describe('ConnectionPointManager – getStats', () => {

    let mgr;
    before(() => {
        ConnectionPointManager.resetInstance();
        mgr = new ConnectionPointManager();
        mgr.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
    });

    it('returns an object with defined and total fields', () => {
        const stats = mgr.getStats();
        assert.ok('defined' in stats);
        assert.ok('total'   in stats);
    });

    it('defined equals 50 (one entry per built-in part)', () => {
        const { defined } = mgr.getStats();
        assert.strictEqual(defined, 50);
    });

    it('total equals 426 (sum of all built-in points)', () => {
        const { total } = mgr.getStats();
        assert.strictEqual(total, 426);
    });

    it('total increases after registering additional points', () => {
        ConnectionPointManager.resetInstance();
        const fresh = new ConnectionPointManager();
        fresh.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
        const before = fresh.getStats().total;
        fresh.registerPoints('extra-part', [makeCP({ id: 'extra_stud_0_0', partId: 'extra-part' })]);
        const after = fresh.getStats().total;
        assert.strictEqual(after, before + 1);
    });
});

// ---------------------------------------------------------------------------
// getWorldPoints
// ---------------------------------------------------------------------------

describe('ConnectionPointManager – getWorldPoints', () => {

    let mgr;
    before(() => {
        ConnectionPointManager.resetInstance();
        mgr = new ConnectionPointManager();
        mgr.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
    });

    it("returns a non-empty array for 'brick_1x1'", () => {
        const result = mgr.getWorldPoints('brick_1x1', {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
        });
        assert.ok(Array.isArray(result));
        assert.ok(result.length > 0);
    });

    it('each entry has point and worldPos fields', () => {
        const result = mgr.getWorldPoints('brick_1x1', {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
        });
        for (const entry of result) {
            assert.ok('point'    in entry, 'missing point field');
            assert.ok('worldPos' in entry, 'missing worldPos field');
        }
    });

    it('each point in the result is a ConnectionPoint instance', () => {
        const result = mgr.getWorldPoints('brick_1x1', {
            position: { x: 0, y: 0, z: 0 },
        });
        for (const { point } of result) {
            assert.ok(point instanceof ConnectionPoint);
        }
    });

    it('worldPos has numeric x, y, z fields', () => {
        const result = mgr.getWorldPoints('brick_1x1', {
            position: { x: 0, y: 0, z: 0 },
        });
        for (const { worldPos } of result) {
            assert.strictEqual(typeof worldPos.x, 'number');
            assert.strictEqual(typeof worldPos.y, 'number');
            assert.strictEqual(typeof worldPos.z, 'number');
        }
    });

    it('worldPos is shifted by the part position', () => {
        const zeroResult = mgr.getWorldPoints('brick_1x1', {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
        });
        const shiftResult = mgr.getWorldPoints('brick_1x1', {
            position: { x: 5, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
        });
        assert.strictEqual(zeroResult.length, shiftResult.length);
        for (let i = 0; i < zeroResult.length; i++) {
            assert.ok(
                Math.abs(shiftResult[i].worldPos.x - (zeroResult[i].worldPos.x + 5)) < 1e-6,
                'worldPos.x should be shifted by 5'
            );
        }
    });

    it("returns empty array for unknown partId", () => {
        const result = mgr.getWorldPoints('no-such-part', {
            position: { x: 0, y: 0, z: 0 },
        });
        assert.deepEqual(result, []);
    });
});
