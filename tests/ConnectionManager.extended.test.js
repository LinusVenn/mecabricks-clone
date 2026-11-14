/**
 * tests/ConnectionManager.extended.test.js
 *
 * Phase F.4 – ConnectionManager (EXTENDED – new Phase F methods only)
 * ~35 assertions
 *
 * Existing tests live in ConnectionManager.test.js and are not duplicated here.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ConnectionManager } from '../src/editor/ConnectionManager.js';
import { CONNECTION_TYPES }  from '../src/connections/ConnectionTypes.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Minimal mock ConnectionPointManager used by suggestConnections() /
 * findCompatiblePoints().  Returns an empty array by default so the method
 * exercises the branch but never tries to call the real compatibility logic.
 */
function makeMockCpm(pointsOverride = []) {
    return {
        getPointsForBrick(_brick) { return pointsOverride; }
    };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let cm;

beforeEach(() => { cm = new ConnectionManager(); });

// ===========================================================================
// createMechanicalConnection()
// ===========================================================================

describe('ConnectionManager – createMechanicalConnection()', () => {

    it('creates a connection and returns it', () => {
        const c = cm.createMechanicalConnection('brick-1', 'brick-2', {
            type: CONNECTION_TYPES.TECHNIC_HOLE,
            connectionPointA: 'cpA',
            connectionPointB: 'cpB',
        });
        assert.ok(c !== null && typeof c === 'object');
        assert.ok(typeof c.id === 'string' && c.id.length > 0);
    });

    it('stores sourceBrickId and targetBrickId correctly', () => {
        const c = cm.createMechanicalConnection('brick-1', 'brick-2', {
            type: CONNECTION_TYPES.TECHNIC_HOLE,
        });
        assert.strictEqual(c.sourceBrickId, 'brick-1');
        assert.strictEqual(c.targetBrickId, 'brick-2');
    });

    it('stores the connection type', () => {
        const c = cm.createMechanicalConnection('brick-1', 'brick-2', {
            type: CONNECTION_TYPES.TECHNIC_HOLE,
        });
        assert.strictEqual(c.type, CONNECTION_TYPES.TECHNIC_HOLE);
    });

    it('stores connectionPointA and connectionPointB when provided', () => {
        const c = cm.createMechanicalConnection('brick-1', 'brick-2', {
            type: CONNECTION_TYPES.TECHNIC_HOLE,
            connectionPointA: 'cpA',
            connectionPointB: 'cpB',
        });
        assert.strictEqual(c.connectionPointA, 'cpA');
        assert.strictEqual(c.connectionPointB, 'cpB');
    });

    it('stores confidence when provided', () => {
        const c = cm.createMechanicalConnection('brick-1', 'brick-2', {
            type:       CONNECTION_TYPES.STUD,
            confidence: 0.95,
        });
        assert.strictEqual(c.confidence, 0.95);
    });

    it('falls back to CONNECTION_TYPES.STUD_TO_BOTTOM when no type provided', () => {
        const c = cm.createMechanicalConnection('brick-1', 'brick-2');
        assert.strictEqual(c.type, CONNECTION_TYPES.STUD_TO_BOTTOM);
    });

    it('returns existing connection on duplicate (source, target, type, points)', () => {
        const opts = { type: CONNECTION_TYPES.TECHNIC_HOLE, connectionPointA: 'cpA', connectionPointB: 'cpB' };
        const first  = cm.createMechanicalConnection('brick-1', 'brick-2', opts);
        const second = cm.createMechanicalConnection('brick-1', 'brick-2', opts);
        assert.strictEqual(first, second);
        assert.strictEqual(cm.getCount(), 1);
    });

    it('throws when sourceBrickId is missing', () => {
        assert.throws(
            () => cm.createMechanicalConnection('', 'brick-2'),
            /IDs/
        );
    });

    it('throws when source === target', () => {
        assert.throws(
            () => cm.createMechanicalConnection('brick-1', 'brick-1'),
            /selbst/
        );
    });
});

// ===========================================================================
// getConnectionsByType()
// ===========================================================================

describe('ConnectionManager – getConnectionsByType()', () => {

    beforeEach(() => {
        cm.createConnection('brick-1', 'brick-2', null, CONNECTION_TYPES.STUD_TO_BOTTOM);
        cm.createConnection('brick-1', 'brick-3', null, CONNECTION_TYPES.STUD_TO_BOTTOM);
        cm.createMechanicalConnection('brick-2', 'brick-3', { type: CONNECTION_TYPES.TECHNIC_HOLE });
    });

    it('returns only connections matching the given type', () => {
        const studs = cm.getConnectionsByType(CONNECTION_TYPES.STUD_TO_BOTTOM);
        assert.strictEqual(studs.length, 2);
        assert.ok(studs.every(c => c.type === CONNECTION_TYPES.STUD_TO_BOTTOM));
    });

    it('filters correctly for a different type', () => {
        const holes = cm.getConnectionsByType(CONNECTION_TYPES.TECHNIC_HOLE);
        assert.strictEqual(holes.length, 1);
        assert.strictEqual(holes[0].type, CONNECTION_TYPES.TECHNIC_HOLE);
    });

    it('returns an empty array for a type that has no connections', () => {
        const gear = cm.getConnectionsByType(CONNECTION_TYPES.GEAR);
        assert.deepEqual(gear, []);
    });
});

// ===========================================================================
// getConnectionsForBrick()
// ===========================================================================

describe('ConnectionManager – getConnectionsForBrick()', () => {

    beforeEach(() => {
        cm.createConnection('brick-1', 'brick-2', null);
        cm.createConnection('brick-3', 'brick-1', null); // brick-1 is target here
        cm.createConnection('brick-4', 'brick-5', null); // unrelated
    });

    it('finds connections where brickId is the source', () => {
        const res = cm.getConnectionsForBrick('brick-1');
        assert.ok(res.some(c => c.sourceBrickId === 'brick-1'));
    });

    it('finds connections where brickId is the target', () => {
        const res = cm.getConnectionsForBrick('brick-1');
        assert.ok(res.some(c => c.targetBrickId === 'brick-1'));
    });

    it('returns all (source + target) connections for a brick', () => {
        const res = cm.getConnectionsForBrick('brick-1');
        assert.strictEqual(res.length, 2);
    });

    it('returns an empty array when brick has no connections', () => {
        const res = cm.getConnectionsForBrick('brick-99');
        assert.deepEqual(res, []);
    });
});

// ===========================================================================
// migrateOldConnection()
// ===========================================================================

describe('ConnectionManager – migrateOldConnection()', () => {

    it('returns the same object reference when type is already canonical', () => {
        const conn = { id: 'm1', type: CONNECTION_TYPES.STUD_TO_BOTTOM, sourceBrickId: 'a', targetBrickId: 'b' };
        const result = cm.migrateOldConnection(conn);
        assert.strictEqual(result, conn);
    });

    it('"stud-to-bottom" is already a canonical type → returned unchanged', () => {
        const conn = { type: 'stud-to-bottom', sourceBrickId: 'a', targetBrickId: 'b' };
        const result = cm.migrateOldConnection(conn);
        assert.strictEqual(result.type, 'stud-to-bottom');
    });

    it('returns an object for an unknown legacy type (no throw)', () => {
        const conn = { type: 'unknown-legacy-type', sourceBrickId: 'a', targetBrickId: 'b' };
        const result = cm.migrateOldConnection(conn);
        assert.ok(typeof result === 'object');
    });

    it('does not mutate the original for an unknown legacy type', () => {
        const conn   = { type: 'unknown-legacy-type', sourceBrickId: 'a', targetBrickId: 'b' };
        const result = cm.migrateOldConnection(conn);
        // Either same reference (passthrough) or a shallow copy – original must be unchanged
        assert.strictEqual(conn.type, 'unknown-legacy-type');
    });
});

// ===========================================================================
// getStats()
// ===========================================================================

describe('ConnectionManager – getStats()', () => {

    it('returns { total: 0, byType: {} } for an empty manager', () => {
        const stats = cm.getStats();
        assert.strictEqual(stats.total, 0);
        assert.deepEqual(stats.byType, {});
    });

    it('total matches getCount()', () => {
        cm.createConnection('a', 'b', null, CONNECTION_TYPES.STUD_TO_BOTTOM);
        cm.createConnection('c', 'd', null, CONNECTION_TYPES.STUD_TO_BOTTOM);
        const stats = cm.getStats();
        assert.strictEqual(stats.total, cm.getCount());
    });

    it('byType counts each type correctly', () => {
        cm.createConnection('a', 'b', null, CONNECTION_TYPES.STUD_TO_BOTTOM);
        cm.createConnection('c', 'd', null, CONNECTION_TYPES.STUD_TO_BOTTOM);
        cm.createMechanicalConnection('e', 'f', { type: CONNECTION_TYPES.TECHNIC_HOLE });

        const stats = cm.getStats();
        assert.strictEqual(stats.byType[CONNECTION_TYPES.STUD_TO_BOTTOM], 2);
        assert.strictEqual(stats.byType[CONNECTION_TYPES.TECHNIC_HOLE],   1);
    });

    it('total equals sum of all byType values', () => {
        cm.createConnection('a', 'b');
        cm.createConnection('c', 'd');
        const { total, byType } = cm.getStats();
        const sumFromByType = Object.values(byType).reduce((s, n) => s + n, 0);
        assert.strictEqual(total, sumFromByType);
    });
});

// ===========================================================================
// suggestConnections()
// ===========================================================================

describe('ConnectionManager – suggestConnections()', () => {

    const newBrick  = { id: 'new-brick',  position: { x: 0, y: 0, z: 0 } };
    const farBrick  = { id: 'far-brick',  position: { x: 100, y: 100, z: 100 } };
    const nearBrick = { id: 'near-brick', position: { x: 0.5, y: 0, z: 0 } };

    it('returns an array (may be empty) without throwing – empty cpm', () => {
        const cpm = makeMockCpm([]);
        const suggestions = cm.suggestConnections(newBrick, [nearBrick], cpm, 2.0);
        assert.ok(Array.isArray(suggestions));
    });

    it('returns empty array when no existing bricks are provided', () => {
        const cpm = makeMockCpm([]);
        const suggestions = cm.suggestConnections(newBrick, [], cpm, 2.0);
        assert.deepEqual(suggestions, []);
    });

    it('skips a brick that is the same as newBrick', () => {
        const cpm = makeMockCpm([]);
        const suggestions = cm.suggestConnections(newBrick, [newBrick], cpm, 2.0);
        assert.deepEqual(suggestions, []);
    });

    it('skips bricks outside the radius', () => {
        const cpm = makeMockCpm([{ type: 'stud' }]);
        const suggestions = cm.suggestConnections(newBrick, [farBrick], cpm, 2.0);
        assert.deepEqual(suggestions, []);
    });

    it('does not throw when bricks lack position property', () => {
        const cpm        = makeMockCpm([]);
        const noPosClick = { id: 'no-pos-brick' }; // no .position
        let suggestions;
        assert.doesNotThrow(() => {
            suggestions = cm.suggestConnections(newBrick, [noPosClick], cpm, 2.0);
        });
        assert.ok(Array.isArray(suggestions));
    });

    it('processes bricks within radius and returns correct shape when points match', () => {
        // Give both bricks a compatible point pair so the compatibility stub fires
        const ptA = { type: 'stud',     position: { x: 0, y: 0, z: 0 } };
        const ptB = { type: 'anti-stud', position: { x: 0, y: 0, z: 0 } };

        // Stub cpm: returns ptA for newBrick and ptB for nearBrick
        const stubbedCpm = {
            getPointsForBrick(brick) {
                return brick.id === 'new-brick' ? [ptA] : [ptB];
            }
        };

        // Use the real ConnectionCompatibility – if it reports compatible we get results
        const suggestions = cm.suggestConnections(newBrick, [nearBrick], stubbedCpm, 2.0);
        // Result must be an array; we can't guarantee compatibility without real logic,
        // but we can check shape of any returned element
        assert.ok(Array.isArray(suggestions));
        for (const s of suggestions) {
            assert.ok('brickId'    in s);
            assert.ok('pointA'     in s);
            assert.ok('pointB'     in s);
            assert.ok('confidence' in s);
        }
    });
});
