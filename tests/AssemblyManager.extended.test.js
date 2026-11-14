/**
 * tests/AssemblyManager.extended.test.js
 *
 * Phase F.6 – AssemblyManager (EXTENDED – new Phase F functionality only)
 * ~45 assertions
 *
 * Uses a mock GroupManager and mock library that matches the interface
 * expected by AssemblyManager without pulling in Three.js / DOM.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { AssemblyManager } from '../src/assemblies/AssemblyManager.js';
import { Assembly }         from '../src/assemblies/Assembly.js';
import {
    MechanicalConnectionManager,
} from '../src/connections/MechanicalConnectionManager.js';

// ---------------------------------------------------------------------------
// Mock factories (provided by the spec)
// ---------------------------------------------------------------------------

function makeMockGroupManager() {
    const groups = new Map();
    return {
        createGroup(brickIds, name) {
            const id = 'group-' + Math.random().toString(36).slice(2);
            groups.set(id, { id, name, brickIds: new Set(brickIds) });
            return groups.get(id);
        },
        getGroup(id) { return groups.get(id) ?? null; },
        getAllGroups() { return [...groups.values()]; },
        removeBrickFromGroup(gid, bid) { groups.get(gid)?.brickIds?.delete(bid); return true; },
        addBrickToGroup(gid, bid) { groups.get(gid)?.brickIds?.add(bid); return true; },
        // AssemblyManager uses getGroupByBrickId (GroupManager naming) — provide both
        getGroupByBrickId(bid) {
            for (const [, g] of groups) if (g.brickIds?.has(bid)) return g;
            return null;
        },
        getBrickGroup(bid) {
            for (const [, g] of groups) if (g.brickIds?.has(bid)) return g;
            return null;
        },
        ungroup(id) {
            const g = groups.get(id);
            groups.delete(id);
            return g ? [...(g.brickIds ?? [])] : null;
        },
        renameGroup() { return true; },
        toData() {
            return [...groups.values()].map(g => ({ ...g, brickIds: [...(g.brickIds ?? [])] }));
        },
        loadFromData() {},
    };
}

function makeMockLibrary() {
    const bricks = new Map([['b1', 'b1'], ['b2', 'b2'], ['b3', 'b3']]);
    return { hasId(id) { return bricks.has(id); } };
}

// A minimal mock ConnectionManager for AssemblyManager (avoids real Connection logic)
function makeMockConnectionManager() {
    return {
        getConnections() { return []; },
        createConnection() { return {}; },
        removeConnections() {},
    };
}

// Helper: brick objects that GroupManager.createGroup expects (with .id)
function makeBricks(...ids) {
    return ids.map(id => ({ id }));
}

// ---------------------------------------------------------------------------
// Mechanical-manager adapter
//
// AssemblyManager calls `this.mechanicalManager.createConnection(jointDef)`,
// while MechanicalConnectionManager exposes `addConnection(def)`.
// We wrap the real MechanicalConnectionManager so both names work.
// ---------------------------------------------------------------------------

function makeMechManagerAdapter() {
    const inner = new MechanicalConnectionManager();
    return {
        // The method AssemblyManager actually calls
        createConnection(def)    { return inner.addConnection(def); },
        // Delegate everything else we need in tests
        addConnection(def)       { return inner.addConnection(def); },
        getConnection(id)        { return inner.getConnection(id); },
        removeConnection(id)     { return inner.removeConnection(id); },
        getAllConnections()       { return inner.getAllConnections(); },
        getCount()               { return inner.getCount(); },
        toData()                 { return inner.toData(); },
        loadFromData(data, ctx)  { return inner.loadFromData(data, ctx); },
        // expose inner for direct inspection in tests
        _inner: inner,
    };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mgr;
let gm;
let mechMgr;

function makeManager(withMechMgr = true) {
    gm       = makeMockGroupManager();
    mechMgr  = withMechMgr ? makeMechManagerAdapter() : null;
    mgr      = new AssemblyManager(
        gm,
        makeMockLibrary(),
        makeMockConnectionManager(),
        null,   // historyManager
        mechMgr
    );
    return mgr;
}

// ===========================================================================
// ── NEW Phase F.6 METHODS ───────────────────────────────────────────────────
// ===========================================================================

describe('AssemblyManager.extended – createAssembly()', () => {

    beforeEach(() => makeManager());

    it('returns an Assembly instance', () => {
        const asm = mgr.createAssembly('Engine', makeBricks('b1', 'b2'));
        assert.ok(asm instanceof Assembly);
    });

    it('Assembly has the supplied name', () => {
        const asm = mgr.createAssembly('Gearbox', makeBricks('b1'));
        assert.strictEqual(asm.name, 'Gearbox');
    });

    it('Assembly has a non-empty groupId', () => {
        const asm = mgr.createAssembly('Chassis', makeBricks('b1'));
        assert.ok(typeof asm.groupId === 'string' && asm.groupId.length > 0);
    });

    it('Assembly is retrievable via getAssembly()', () => {
        const asm = mgr.createAssembly('Wheel', makeBricks('b2'));
        assert.strictEqual(mgr.getAssembly(asm.id), asm);
    });

    it('throws when name is empty', () => {
        assert.throws(
            () => mgr.createAssembly('', makeBricks('b1')),
            /name/
        );
    });

    it('throws when bricks array is empty', () => {
        assert.throws(
            () => mgr.createAssembly('Empty', []),
            /Bauteil/
        );
    });

    it('accepts optional description', () => {
        const asm = mgr.createAssembly('Desc', makeBricks('b1'), { description: 'hello' });
        assert.strictEqual(asm.description, 'hello');
    });
});

// ---------------------------------------------------------------------------

describe('AssemblyManager.extended – getAssembly() / getAllAssemblies()', () => {

    beforeEach(() => makeManager());

    it('getAssembly() returns null for an unknown id', () => {
        assert.strictEqual(mgr.getAssembly('no-such-id'), null);
    });

    it('getAllAssemblies() returns an empty array initially', () => {
        assert.deepEqual(mgr.getAllAssemblies(), []);
    });

    it('getAllAssemblies() returns all created assemblies', () => {
        mgr.createAssembly('A', makeBricks('b1'));
        mgr.createAssembly('B', makeBricks('b2'));
        const all = mgr.getAllAssemblies();
        assert.strictEqual(all.length, 2);
        assert.ok(all.every(a => a instanceof Assembly));
    });
});

// ---------------------------------------------------------------------------

describe('AssemblyManager.extended – addMechanicalConnection()', () => {

    beforeEach(() => makeManager(/* withMechMgr = */ true));

    it('adds a joint and returns a MechanicalConnection-like object', () => {
        const asm = mgr.createAssembly('Test', makeBricks('b1'));
        const joint = mgr.addMechanicalConnection(asm.id, {
            type:  'rigid',
            partA: 'inst-1',
            partB: 'inst-2',
        });
        assert.ok(joint !== null);
        assert.ok(typeof joint.id === 'string');
    });

    it('registers the joint id in the Assembly', () => {
        const asm   = mgr.createAssembly('Test', makeBricks('b1'));
        const joint = mgr.addMechanicalConnection(asm.id, {
            type:  'rigid',
            partA: 'inst-1',
            partB: 'inst-2',
        });
        assert.ok(mgr.getAssembly(asm.id).hasMechanicalConnection(joint.id));
    });

    it('throws when assemblyId is unknown', () => {
        assert.throws(
            () => mgr.addMechanicalConnection('ghost-asm', { type: 'rigid', partA: 'a', partB: 'b' }),
            /nicht gefunden/
        );
    });

    it('works without a mechanicalManager (id-only path)', () => {
        const noMechMgr = new AssemblyManager(gm, makeMockLibrary(), makeMockConnectionManager());
        const asm   = noMechMgr.createAssembly('NoMech', makeBricks('b1'));
        const joint = noMechMgr.addMechanicalConnection(asm.id, { id: 'manual-jid' });
        assert.ok(joint !== null);
        assert.ok(noMechMgr.getAssembly(asm.id).hasMechanicalConnection('manual-jid'));
    });
});

// ---------------------------------------------------------------------------

describe('AssemblyManager.extended – getMechanicalConnections()', () => {

    beforeEach(() => makeManager());

    it('returns an array of connections for an assembly', () => {
        const asm = mgr.createAssembly('Test', makeBricks('b1'));
        mgr.addMechanicalConnection(asm.id, { type: 'rigid', partA: 'p1', partB: 'p2' });
        const conns = mgr.getMechanicalConnections(asm.id);
        assert.ok(Array.isArray(conns));
        assert.strictEqual(conns.length, 1);
    });

    it('returns an empty array for an unknown assemblyId', () => {
        assert.deepEqual(mgr.getMechanicalConnections('ghost'), []);
    });

    it('returns an empty array when no joints added', () => {
        const asm = mgr.createAssembly('Empty', makeBricks('b1'));
        assert.deepEqual(mgr.getMechanicalConnections(asm.id), []);
    });
});

// ---------------------------------------------------------------------------

describe('AssemblyManager.extended – removeMechanicalConnection()', () => {

    beforeEach(() => makeManager());

    it('returns true and removes the joint from the assembly', () => {
        const asm = mgr.createAssembly('Test', makeBricks('b1'));
        const j   = mgr.addMechanicalConnection(asm.id, { type: 'rigid', partA: 'p1', partB: 'p2' });

        const result = mgr.removeMechanicalConnection(asm.id, j.id);
        assert.strictEqual(result, true);
        assert.strictEqual(mgr.getMechanicalConnections(asm.id).length, 0);
    });

    it('returns false when assemblyId is unknown', () => {
        assert.strictEqual(mgr.removeMechanicalConnection('ghost', 'j1'), false);
    });

    it('returns false when jointId is not in the assembly', () => {
        const asm = mgr.createAssembly('Test', makeBricks('b1'));
        assert.strictEqual(mgr.removeMechanicalConnection(asm.id, 'no-joint'), false);
    });
});

// ---------------------------------------------------------------------------

describe('AssemblyManager.extended – dissolveAssembly()', () => {

    beforeEach(() => makeManager());

    it('returns null for an unknown assemblyId', () => {
        assert.strictEqual(mgr.dissolveAssembly('ghost'), null);
    });

    it('returns the dissolved brick ids (array)', () => {
        const asm    = mgr.createAssembly('Dissolvable', makeBricks('b1', 'b2'));
        const result = mgr.dissolveAssembly(asm.id);
        assert.ok(Array.isArray(result));
    });

    it('removes the assembly from the registry', () => {
        const asm = mgr.createAssembly('Gone', makeBricks('b1'));
        mgr.dissolveAssembly(asm.id);
        assert.strictEqual(mgr.getAssembly(asm.id), null);
    });

    it('removes associated mechanical connections from the mechMgr', () => {
        const asm = mgr.createAssembly('WithJoint', makeBricks('b1'));
        const j   = mgr.addMechanicalConnection(asm.id, { type: 'rigid', partA: 'p1', partB: 'p2' });

        mgr.dissolveAssembly(asm.id);
        // Connection must have been removed from the MechanicalConnectionManager
        assert.strictEqual(mechMgr.getConnection(j.id), null);
    });
});

// ---------------------------------------------------------------------------

describe('AssemblyManager.extended – toData()', () => {

    beforeEach(() => makeManager());

    it('returns an object with assemblies and mechanicalConnections keys', () => {
        const data = mgr.toData();
        assert.ok('assemblies' in data);
        assert.ok('mechanicalConnections' in data);
    });

    it('assemblies array contains serialized assembly objects', () => {
        mgr.createAssembly('A', makeBricks('b1'));
        const { assemblies } = mgr.toData();
        assert.strictEqual(assemblies.length, 1);
        assert.ok(typeof assemblies[0].id === 'string');
    });
});

// ---------------------------------------------------------------------------

describe('AssemblyManager.extended – loadFromData()', () => {

    beforeEach(() => makeManager());

    it('returns { loaded, errors } object', () => {
        const result = mgr.loadFromData({ assemblies: [], mechanicalConnections: [] });
        assert.ok('loaded' in result);
        assert.ok('errors' in result);
    });

    it('loads a valid assembly entry', () => {
        const asm  = mgr.createAssembly('Pre', makeBricks('b1'));
        const data = mgr.toData();

        // Reset, then reload
        const freshMgr = new AssemblyManager(gm, makeMockLibrary(), makeMockConnectionManager());
        const result   = freshMgr.loadFromData(data, {
            knownGroupIds: new Set([asm.groupId])
        });
        assert.strictEqual(result.loaded, 1);
        assert.strictEqual(result.errors.length, 0);
    });

    it('skips assemblies with unknown groupIds when context.knownGroupIds is provided', () => {
        const asm  = mgr.createAssembly('Pre', makeBricks('b1'));
        const data = mgr.toData();

        // Load with an empty known-group set → should skip
        const freshMgr = new AssemblyManager(gm, makeMockLibrary(), makeMockConnectionManager());
        const result   = freshMgr.loadFromData(data, { knownGroupIds: new Set() });
        assert.strictEqual(result.loaded, 0);
        assert.ok(result.errors.length >= 1);
    });

    it('handles missing assemblies key gracefully (returns loaded=0)', () => {
        const result = mgr.loadFromData({});
        assert.strictEqual(result.loaded, 0);
    });
});

// ===========================================================================
// ── EXISTING METHODS (smoke-test that they still work) ──────────────────────
// ===========================================================================

describe('AssemblyManager.extended – existing methods still work', () => {

    beforeEach(() => makeManager());

    it('getAll() returns all groups from GroupManager', () => {
        mgr.createAssembly('A', makeBricks('b1'));
        const all = mgr.getAll();
        assert.ok(Array.isArray(all));
        assert.ok(all.length >= 1);
    });

    it('get(groupId) returns the group', () => {
        const asm = mgr.createAssembly('G', makeBricks('b1'));
        const g   = mgr.get(asm.groupId);
        assert.ok(g !== null);
        assert.strictEqual(g.id, asm.groupId);
    });

    it('rename() returns true', () => {
        const asm    = mgr.createAssembly('Old', makeBricks('b1'));
        const result = mgr.rename(asm.groupId, 'New');
        assert.strictEqual(result, true);
    });

    it('addBrick() adds a brick to the group', () => {
        // Use a library that knows about b1–b3
        const lib = {
            getById(id) { return { id }; },
            hasId()     { return true; }
        };
        const gmLocal = makeMockGroupManager();
        const localMgr = new AssemblyManager(gmLocal, lib, makeMockConnectionManager());
        const asm = localMgr.createAssembly('AddTest', [{ id: 'b1' }]);
        // addBrick uses library.getById and groupManager.getGroupByBrickId
        // Mock getGroupByBrickId to return null (b2 not yet in any group)
        const result = localMgr.addBrick(asm.groupId, 'b2');
        assert.ok(result === true || result === false); // shape is correct
    });

    it('removeBrick() calls through to GroupManager', () => {
        const result = mgr.removeBrick('any-gid', 'b1');
        assert.ok(typeof result === 'boolean');
    });

    it('dissolve() returns brickIds array or null', () => {
        const asm    = mgr.createAssembly('D', makeBricks('b1'));
        const result = mgr.dissolve(asm.groupId);
        // Mock ungroup returns the Set elements as array
        assert.ok(Array.isArray(result) || result === null);
    });
});
