/**
 * ModelSnapshot – Phase G tests
 *
 * Coverage (~20 assertions):
 *  - capture(..., mechMgr) includes mechanicalConnections array
 *  - capture(..., mechMgr=null) → mechanicalConnections: []
 *  - capture(...) with mechMgr having one connection → array with one entry
 *  - restore(..., mechMgr) calls mechMgr.clear()
 *  - restore(...) with mechanicalConnections in snapshot → calls mechMgr.loadFromData()
 *  - restore(...) with no mechMgr → does not throw
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ModelSnapshot } from '../src/history/ModelSnapshot.js';

// ─── Minimal mock helpers ─────────────────────────────────────────────────────

function makeMockLibrary(bricks = []) {
    return {
        getAllData:       () => bricks,
        clear:           () => {},
        addBrickFromData: () => {},
    };
}

function makeMockConnectionManager(connections = []) {
    return {
        toData:       () => connections,
        clear:        () => {},
        loadFromData: () => {},
    };
}

function makeMockGroupManager() {
    return {
        toData:       () => [],
        clear:        () => {},
        loadFromData: () => {},
    };
}

function makeMockComponentLibrary() {
    return {
        toData:       () => [],
        clear:        () => {},
        loadFromData: () => {},
    };
}

/**
 * Creates a mock MechanicalConnectionManager.
 *
 * @param {Array}   connections  – connections returned by toData()
 * @param {object}  [spy]        – optional spy object to track calls
 */
function makeMockMechManager(connections = [], spy = {}) {
    return {
        toData: () => ({ mechanicalConnections: connections }),
        clear:  () => { spy.clearCalled = (spy.clearCalled || 0) + 1; },
        loadFromData: (data, ids) => {
            spy.loadCalledWith = { data, ids };
            spy.loadCalled = (spy.loadCalled || 0) + 1;
        },
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ModelSnapshot (Phase G)', () => {

    // ── capture ───────────────────────────────────────────────────────────────

    describe('capture()', () => {

        it('result includes mechanicalConnections array', () => {
            const mechMgr = makeMockMechManager([]);
            const snap = ModelSnapshot.capture(
                makeMockLibrary(),
                makeMockConnectionManager(),
                null,
                null,
                mechMgr
            );
            assert.ok(Array.isArray(snap.mechanicalConnections), 'mechanicalConnections is array');
        });

        it('mechMgr=null → mechanicalConnections: []', () => {
            const snap = ModelSnapshot.capture(
                makeMockLibrary(),
                makeMockConnectionManager(),
                null,
                null,
                null           // no mechMgr
            );
            assert.deepEqual(snap.mechanicalConnections, []);
        });

        it('mechMgr with one connection → array with one entry', () => {
            const mc = { id: 'mc-1', type: 'rigid', partA: 'a', partB: 'b' };
            const mechMgr = makeMockMechManager([mc]);
            const snap = ModelSnapshot.capture(
                makeMockLibrary(),
                makeMockConnectionManager(),
                null,
                null,
                mechMgr
            );
            assert.strictEqual(snap.mechanicalConnections.length, 1);
            assert.deepEqual(snap.mechanicalConnections[0], mc);
        });

        it('mechMgr with zero connections → mechanicalConnections: []', () => {
            const mechMgr = makeMockMechManager([]);
            const snap = ModelSnapshot.capture(
                makeMockLibrary(),
                makeMockConnectionManager(),
                null,
                null,
                mechMgr
            );
            assert.deepEqual(snap.mechanicalConnections, []);
        });

        it('snapshot still has bricks and connections fields', () => {
            const mechMgr = makeMockMechManager([]);
            const snap = ModelSnapshot.capture(
                makeMockLibrary([{ id: 'b1' }]),
                makeMockConnectionManager(),
                null,
                null,
                mechMgr
            );
            assert.ok(Array.isArray(snap.bricks),       'bricks present');
            assert.ok(Array.isArray(snap.connections),   'connections present');
        });

    });

    // ── restore ───────────────────────────────────────────────────────────────

    describe('restore()', () => {

        it('calls mechMgr.clear() when mechMgr provided', () => {
            const spy     = {};
            const mechMgr = makeMockMechManager([], spy);
            const snap    = { bricks: [], connections: [], groups: [], components: [], mechanicalConnections: [] };

            ModelSnapshot.restore(
                snap,
                makeMockLibrary(),
                makeMockConnectionManager(),
                null,
                null,
                mechMgr
            );

            assert.ok(spy.clearCalled >= 1, 'mechMgr.clear() was called');
        });

        it('calls mechMgr.loadFromData when snapshot has connections', () => {
            const spy     = {};
            const mc      = { id: 'mc-1', type: 'rigid', partA: 'a', partB: 'b' };
            const mechMgr = makeMockMechManager([], spy);
            const snap    = {
                bricks:                [],
                connections:           [],
                groups:                [],
                components:            [],
                mechanicalConnections: [mc],
            };

            ModelSnapshot.restore(
                snap,
                makeMockLibrary(),
                makeMockConnectionManager(),
                null,
                null,
                mechMgr
            );

            assert.ok(spy.loadCalled >= 1, 'loadFromData was called');
            assert.ok(Array.isArray(spy.loadCalledWith.data), 'data arg is array');
        });

        it('does NOT call mechMgr.loadFromData when mechanicalConnections is empty', () => {
            const spy     = {};
            const mechMgr = makeMockMechManager([], spy);
            const snap    = { bricks: [], connections: [], groups: [], components: [], mechanicalConnections: [] };

            ModelSnapshot.restore(
                snap,
                makeMockLibrary(),
                makeMockConnectionManager(),
                null,
                null,
                mechMgr
            );

            assert.ok(!spy.loadCalled, 'loadFromData NOT called for empty connections');
        });

        it('restore with no mechMgr does not throw', () => {
            const snap = { bricks: [], connections: [], groups: [], components: [], mechanicalConnections: [] };
            assert.doesNotThrow(() => {
                ModelSnapshot.restore(
                    snap,
                    makeMockLibrary(),
                    makeMockConnectionManager(),
                    null,
                    null,
                    null  // no mechMgr
                );
            });
        });

        it('restore without mechanicalConnections field does not throw', () => {
            const snap = { bricks: [], connections: [], groups: [], components: [] };  // field absent
            const spy  = {};
            const mechMgr = makeMockMechManager([], spy);

            assert.doesNotThrow(() => {
                ModelSnapshot.restore(
                    snap,
                    makeMockLibrary(),
                    makeMockConnectionManager(),
                    null,
                    null,
                    mechMgr
                );
            });
        });

        it('calls library.clear() and connectionManager.clear()', () => {
            let libCleared  = false;
            let connCleared = false;

            const lib = { ...makeMockLibrary(),             clear: () => { libCleared  = true; } };
            const con = { ...makeMockConnectionManager(),   clear: () => { connCleared = true; } };

            const snap = { bricks: [], connections: [], groups: [], components: [], mechanicalConnections: [] };

            ModelSnapshot.restore(snap, lib, con, null, null, null);

            assert.ok(libCleared,  'library.clear() called');
            assert.ok(connCleared, 'connectionManager.clear() called');
        });

    });

    // ── clone ─────────────────────────────────────────────────────────────────

    describe('clone()', () => {

        it('clone produces deep copy — modifying clone does not affect original', () => {
            const mechMgr = makeMockMechManager([{ id: 'mc-1', type: 'rigid', partA: 'a', partB: 'b' }]);
            const snap  = ModelSnapshot.capture(
                makeMockLibrary(),
                makeMockConnectionManager(),
                null, null,
                mechMgr
            );
            const clone = ModelSnapshot.clone(snap);
            clone.mechanicalConnections.push({ id: 'mc-extra' });
            assert.strictEqual(snap.mechanicalConnections.length, 1, 'original unchanged');
        });

    });

});
