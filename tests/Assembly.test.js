/**
 * tests/Assembly.test.js
 *
 * Phase F – Assembly domain object
 * ~40 assertions
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Assembly } from '../src/assemblies/Assembly.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssembly(overrides = {}) {
    return new Assembly({
        name:    'Chassis',
        groupId: 'group-abc',
        ...overrides,
    });
}

// ---------------------------------------------------------------------------
// Constructor – required fields
// ---------------------------------------------------------------------------

describe('Assembly constructor', () => {

    it('creates an instance with name and groupId', () => {
        const a = makeAssembly();
        assert.ok(a instanceof Assembly);
    });

    it('auto-generates an id when none is provided', () => {
        const a = makeAssembly();
        assert.ok(typeof a.id === 'string' && a.id.length > 0);
        assert.ok(a.id.startsWith('assembly-'));
    });

    it('preserves a caller-supplied id', () => {
        const a = makeAssembly({ id: 'custom-id-1' });
        assert.strictEqual(a.id, 'custom-id-1');
    });

    it('throws when name is missing', () => {
        assert.throws(
            () => new Assembly({ groupId: 'gid' }),
            /name/
        );
    });

    it('throws when name is not a string', () => {
        assert.throws(
            () => new Assembly({ name: 42, groupId: 'gid' }),
            /name/
        );
    });

    it('throws when groupId is missing', () => {
        assert.throws(
            () => new Assembly({ name: 'A' }),
            /groupId/
        );
    });

    it('throws when groupId is not a string', () => {
        assert.throws(
            () => new Assembly({ name: 'A', groupId: null }),
            /groupId/
        );
    });

    it('initialises mechanicalConnectionIds to empty array when omitted', () => {
        const a = makeAssembly();
        assert.deepEqual(a.mechanicalConnectionIds, []);
    });

    it('initialises subAssemblyIds to empty array when omitted', () => {
        const a = makeAssembly();
        assert.deepEqual(a.subAssemblyIds, []);
    });

    it('accepts optional mechanicalConnectionIds', () => {
        const a = makeAssembly({ mechanicalConnectionIds: ['j1', 'j2'] });
        assert.deepEqual(a.mechanicalConnectionIds, ['j1', 'j2']);
    });

    it('accepts optional subAssemblyIds', () => {
        const a = makeAssembly({ subAssemblyIds: ['child-1'] });
        assert.deepEqual(a.subAssemblyIds, ['child-1']);
    });
});

// ---------------------------------------------------------------------------
// Getters
// ---------------------------------------------------------------------------

describe('Assembly getters', () => {

    let a;
    beforeEach(() => {
        a = makeAssembly({
            id:      'get-test',
            name:    'Engine',
            groupId: 'g-eng',
        });
    });

    it('name getter returns the trimmed name', () => {
        assert.strictEqual(a.name, 'Engine');
    });

    it('groupId getter returns the group id', () => {
        assert.strictEqual(a.groupId, 'g-eng');
    });

    it('mechanicalConnectionIds getter returns a COPY (not the internal reference)', () => {
        a.addMechanicalConnection('j-1');
        const copy1 = a.mechanicalConnectionIds;
        copy1.push('extra');                     // mutate the copy
        const copy2 = a.mechanicalConnectionIds; // fresh copy each time
        assert.strictEqual(copy2.length, 1);     // internal list unchanged
    });

    it('subAssemblyIds getter returns a COPY (not the internal reference)', () => {
        a.addSubAssembly('child-99');
        const copy = a.subAssemblyIds;
        copy.push('injected');
        assert.strictEqual(a.subAssemblyIds.length, 1);
    });
});

// ---------------------------------------------------------------------------
// addMechanicalConnection / removeMechanicalConnection / hasMechanicalConnection
// ---------------------------------------------------------------------------

describe('Assembly – mechanical connection management', () => {

    let a;
    beforeEach(() => { a = makeAssembly(); });

    it('addMechanicalConnection adds an id', () => {
        a.addMechanicalConnection('joint-1');
        assert.ok(a.mechanicalConnectionIds.includes('joint-1'));
    });

    it('addMechanicalConnection is idempotent on repeat', () => {
        a.addMechanicalConnection('joint-1');
        a.addMechanicalConnection('joint-1');
        assert.strictEqual(a.mechanicalConnectionIds.filter(id => id === 'joint-1').length, 1);
    });

    it('hasMechanicalConnection returns true after adding', () => {
        a.addMechanicalConnection('joint-1');
        assert.strictEqual(a.hasMechanicalConnection('joint-1'), true);
    });

    it('hasMechanicalConnection returns false for a missing id', () => {
        assert.strictEqual(a.hasMechanicalConnection('ghost'), false);
    });

    it('removeMechanicalConnection returns true when id existed', () => {
        a.addMechanicalConnection('joint-1');
        assert.strictEqual(a.removeMechanicalConnection('joint-1'), true);
    });

    it('removeMechanicalConnection actually removes the id', () => {
        a.addMechanicalConnection('joint-1');
        a.removeMechanicalConnection('joint-1');
        assert.strictEqual(a.hasMechanicalConnection('joint-1'), false);
    });

    it('removeMechanicalConnection returns false for a missing id', () => {
        assert.strictEqual(a.removeMechanicalConnection('not-there'), false);
    });
});

// ---------------------------------------------------------------------------
// addSubAssembly / removeSubAssembly
// ---------------------------------------------------------------------------

describe('Assembly – sub-assembly management', () => {

    let a;
    beforeEach(() => { a = makeAssembly({ id: 'parent-asm' }); });

    it('addSubAssembly adds an id', () => {
        a.addSubAssembly('child-1');
        assert.ok(a.subAssemblyIds.includes('child-1'));
    });

    it('addSubAssembly is idempotent on repeat', () => {
        a.addSubAssembly('child-1');
        a.addSubAssembly('child-1');
        assert.strictEqual(a.subAssemblyIds.filter(id => id === 'child-1').length, 1);
    });

    it('addSubAssembly throws when id equals own id (self-reference)', () => {
        assert.throws(
            () => a.addSubAssembly('parent-asm'),
            /selbst/
        );
    });

    it('removeSubAssembly returns true and removes the id', () => {
        a.addSubAssembly('child-1');
        const result = a.removeSubAssembly('child-1');
        assert.strictEqual(result, true);
        assert.ok(!a.subAssemblyIds.includes('child-1'));
    });

    it('removeSubAssembly returns false for a missing id', () => {
        assert.strictEqual(a.removeSubAssembly('no-such-child'), false);
    });
});

// ---------------------------------------------------------------------------
// toData() / fromData() roundtrip
// ---------------------------------------------------------------------------

describe('Assembly serialization', () => {

    let a;
    beforeEach(() => {
        a = makeAssembly({
            id:                      'ser-1',
            name:                    'Steering',
            groupId:                 'g-steer',
            description:             'Front axle steering assembly',
            mechanicalConnectionIds: ['mc-1', 'mc-2'],
            subAssemblyIds:          ['sub-a'],
        });
    });

    it('toData() returns a plain object', () => {
        const d = a.toData();
        assert.ok(typeof d === 'object' && !(d instanceof Assembly));
    });

    it('toData() contains all required fields', () => {
        const d = a.toData();
        assert.strictEqual(d.id,      'ser-1');
        assert.strictEqual(d.name,    'Steering');
        assert.strictEqual(d.groupId, 'g-steer');
        assert.strictEqual(d.description, 'Front axle steering assembly');
        assert.deepEqual(d.mechanicalConnectionIds, ['mc-1', 'mc-2']);
        assert.deepEqual(d.subAssemblyIds, ['sub-a']);
        assert.ok(typeof d.createdAt === 'string');
    });

    it('toData() mechanicalConnectionIds is a copy (not reference)', () => {
        const d = a.toData();
        d.mechanicalConnectionIds.push('injected');
        assert.strictEqual(a.mechanicalConnectionIds.length, 2);
    });

    it('fromData() reconstructs an Assembly with correct fields', () => {
        const d = a.toData();
        const b = Assembly.fromData(d);
        assert.ok(b instanceof Assembly);
        assert.strictEqual(b.id,      a.id);
        assert.strictEqual(b.name,    a.name);
        assert.strictEqual(b.groupId, a.groupId);
        assert.deepEqual(b.mechanicalConnectionIds, a.mechanicalConnectionIds);
        assert.deepEqual(b.subAssemblyIds, a.subAssemblyIds);
    });

    it('fromData(toData()) roundtrip is equivalent to original', () => {
        const clone = Assembly.fromData(a.toData());
        assert.deepEqual(clone.toData(), a.toData());
    });

    it('fromData() throws when id is missing', () => {
        const { id: _omit, ...noId } = a.toData();
        assert.throws(() => Assembly.fromData(noId), /id/);
    });

    it('fromData() throws when name is missing', () => {
        const { name: _omit, ...noName } = a.toData();
        assert.throws(() => Assembly.fromData(noName), /name/);
    });

    it('fromData() throws when groupId is missing', () => {
        const { groupId: _omit, ...noGroup } = a.toData();
        assert.throws(() => Assembly.fromData(noGroup), /groupId/);
    });

    it('fromData() throws for non-object input', () => {
        assert.throws(() => Assembly.fromData(null), Error);
        assert.throws(() => Assembly.fromData('str'), Error);
    });
});
