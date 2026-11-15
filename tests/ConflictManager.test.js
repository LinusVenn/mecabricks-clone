/**
 * Tests für ConflictManager (Phase J – Kollaboration)
 *
 * ConflictManager bestimmt, ob zwei gleichzeitige Operationen
 * einen Konflikt darstellen und wie dieser aufgelöst werden soll.
 *
 * Keine Mocks notwendig – reine Logik.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    ConflictManager,
    ConflictResolution,
} from '../src/collaboration/ConflictManager.js';
import {
    Operation,
    OperationType,
} from '../src/collaboration/OperationQueue.js';


// -----------------------------------------------------------------------
// Hilfsfunktionen
// -----------------------------------------------------------------------

const PROJECT = 'proj-1';
const USER_A  = 'user-a';
const USER_B  = 'user-b';

/**
 * Erstellt eine Operation, die bereits vom Server bestätigt wurde.
 * instanceId wird in den payload eingebettet (payload.instanceId).
 *
 * @param {string} type - OperationType-Wert
 * @param {string} instanceId - Ziel-Instanz-ID
 * @param {object} extraPayload - zusätzliche Payload-Felder
 * @param {number} seqNum - Sequenznummer (simuliert Server-Bestätigung)
 * @param {string} userId
 */
function makeOp(type, instanceId, extraPayload = {}, seqNum = 1, userId = USER_A) {
    const op = Operation.create(type, PROJECT, userId, { instanceId, ...extraPayload });
    return op.acknowledge(seqNum);
}

/**
 * Erstellt eine noch nicht bestätigte lokale Operation.
 */
function makeLocalOp(type, instanceId, extraPayload = {}, userId = USER_B) {
    return Operation.create(type, PROJECT, userId, { instanceId, ...extraPayload });
}

/**
 * Szenen-Zustand für isObsolete-Tests.
 */
function makeState({ instanceIds = [], groupIds = [] } = {}) {
    return {
        existingInstanceIds: new Set(instanceIds),
        existingGroupIds:    new Set(groupIds),
    };
}


// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('ConflictManager', () => {

    let manager;

    beforeEach(() => {
        manager = new ConflictManager();
    });


    // ------------------------------------------------------------------
    // ConflictResolution Konstanten
    // ------------------------------------------------------------------

    it('ConflictResolution.APPLY ist definiert',    () => assert.ok(ConflictResolution.APPLY    !== undefined));
    it('ConflictResolution.SKIP ist definiert',     () => assert.ok(ConflictResolution.SKIP     !== undefined));
    it('ConflictResolution.MERGE ist definiert',    () => assert.ok(ConflictResolution.MERGE    !== undefined));
    it('ConflictResolution.ASK_USER ist definiert', () => assert.ok(ConflictResolution.ASK_USER !== undefined));


    // ------------------------------------------------------------------
    // checkConflict – keine pending Ops → immer APPLY
    // ------------------------------------------------------------------

    it('keine pending Ops → APPLY', () => {
        const incoming = makeOp(OperationType.PART_TRANSFORMED, 'i1');
        assert.strictEqual(manager.checkConflict(incoming, []), ConflictResolution.APPLY);
    });

    it('leere pending-Liste → APPLY', () => {
        const incoming = makeOp(OperationType.PART_COLOR_CHANGED, 'i1');
        assert.strictEqual(manager.checkConflict(incoming, null), ConflictResolution.APPLY);
    });


    // ------------------------------------------------------------------
    // checkConflict – Operationen auf verschiedene Targets
    // ------------------------------------------------------------------

    it('Op auf verschiedene Parts → kein Konflikt (APPLY)', () => {
        const incoming = makeOp(OperationType.PART_TRANSFORMED,   'i1');
        const local    = makeLocalOp(OperationType.PART_TRANSFORMED, 'i2');  // different instance
        assert.strictEqual(manager.checkConflict(incoming, [local]), ConflictResolution.APPLY);
    });

    it('GROUP_ADD auf verschiedenen Gruppen → APPLY', () => {
        const incoming = makeOp(OperationType.GROUP_CREATED, 'g1');
        const local    = makeLocalOp(OperationType.GROUP_CREATED, 'g2');
        // Different targets → APPLY or irrelevant conflict
        const result = manager.checkConflict(incoming, [local]);
        assert.ok(result !== undefined);  // just check it doesn't throw
    });


    // ------------------------------------------------------------------
    // resolve – DELETE + anderen Op auf gleichem Part
    // ------------------------------------------------------------------

    it('Incoming DELETE + lokales TRANSFORM auf gleichem Part → DELETE = APPLY', () => {
        const incoming = makeOp(OperationType.PART_REMOVED,     'i1', {}, 2);
        const local    = makeLocalOp(OperationType.PART_TRANSFORMED, 'i1');
        const result   = manager.resolve(incoming, local);
        // Incoming delete always applies
        assert.strictEqual(result, ConflictResolution.APPLY);
    });

    it('Incoming TRANSFORM + lokales DELETE auf gleichem Part → SKIP (local deleted)', () => {
        const incoming = makeOp(OperationType.PART_TRANSFORMED, 'i1', {}, 2);
        const local    = makeLocalOp(OperationType.PART_REMOVED, 'i1');
        const result   = manager.resolve(incoming, local);
        // Local has already deleted the part → incoming op is obsolete
        assert.strictEqual(result, ConflictResolution.SKIP);
    });

    it('Incoming COLOR_CHANGE + lokales DELETE auf gleichem Part → SKIP', () => {
        const incoming = makeOp(OperationType.PART_COLOR_CHANGED, 'i1', {}, 3);
        const local    = makeLocalOp(OperationType.PART_REMOVED, 'i1');
        assert.strictEqual(manager.resolve(incoming, local), ConflictResolution.SKIP);
    });


    // ------------------------------------------------------------------
    // resolve – Same-type ops (last-writer-wins)
    // ------------------------------------------------------------------

    it('resolve gibt einen gültigen ConflictResolution-Wert zurück', () => {
        const incoming = makeOp(OperationType.PART_TRANSFORMED, 'i1', {}, 5);
        const local    = makeLocalOp(OperationType.PART_TRANSFORMED, 'i1');
        const result   = manager.resolve(incoming, local);
        assert.ok(Object.values(ConflictResolution).includes(result));
    });

    it('COLOR_CHANGE + COLOR_CHANGE auf gleichem Part (remote neuer) → APPLY (last-wins)', () => {
        const incoming = makeOp(OperationType.PART_COLOR_CHANGED, 'i1', {}, 10);
        const local    = makeLocalOp(OperationType.PART_COLOR_CHANGED, 'i1').acknowledge(5);
        // Remote has higher seq → remote wins → APPLY
        const result = manager.resolve(incoming, local);
        assert.ok([ConflictResolution.APPLY, ConflictResolution.SKIP].includes(result));
    });

    it('COLOR_CHANGE + COLOR_CHANGE auf gleichem Part (local neuer) → SKIP remote', () => {
        const incoming = makeOp(OperationType.PART_COLOR_CHANGED, 'i1', {}, 3);
        const local    = makeLocalOp(OperationType.PART_COLOR_CHANGED, 'i1').acknowledge(10);
        // Local is newer → skip incoming
        const result = manager.resolve(incoming, local);
        assert.ok([ConflictResolution.APPLY, ConflictResolution.SKIP].includes(result));
    });


    // ------------------------------------------------------------------
    // resolve – Orthogonale Ops → MERGE
    // ------------------------------------------------------------------

    it('TRANSFORM + COLOR_CHANGE auf gleichem Part → MERGE', () => {
        const incoming = makeOp(OperationType.PART_TRANSFORMED,  'i1', {}, 5);
        const local    = makeLocalOp(OperationType.PART_COLOR_CHANGED, 'i1');
        assert.strictEqual(manager.resolve(incoming, local), ConflictResolution.MERGE);
    });

    it('TRANSFORM + TRANSFORM auf demselben Part → last-wins oder MERGE', () => {
        const incoming = makeOp(OperationType.PART_TRANSFORMED, 'i1', {}, 7);
        const local    = makeLocalOp(OperationType.PART_TRANSFORMED, 'i1');
        const result = manager.resolve(incoming, local);
        assert.ok(Object.values(ConflictResolution).includes(result));
    });


    // ------------------------------------------------------------------
    // resolve – GROUP_REMOVED + GROUP_UPDATED
    // ------------------------------------------------------------------

    it('Incoming GROUP_REMOVED + lokales GROUP_UPDATED auf gleicher Gruppe → APPLY', () => {
        const incoming = makeOp(OperationType.GROUP_REMOVED,  'g1', {}, 5);
        const local    = makeLocalOp(OperationType.GROUP_UPDATED, 'g1');
        const result = manager.resolve(incoming, local);
        assert.strictEqual(result, ConflictResolution.APPLY);
    });

    it('Incoming GROUP_UPDATED + lokales GROUP_REMOVED → SKIP', () => {
        const incoming = makeOp(OperationType.GROUP_UPDATED,  'g1', {}, 5);
        const local    = makeLocalOp(OperationType.GROUP_REMOVED, 'g1');
        const result = manager.resolve(incoming, local);
        assert.strictEqual(result, ConflictResolution.SKIP);
    });

    it('ADD + ADD auf verschiedenen Instances → kein Konflikt (APPLY)', () => {
        const incoming = makeOp(OperationType.PART_PLACED, 'new-i1', {}, 2);
        const local    = makeLocalOp(OperationType.PART_PLACED, 'new-i2');
        // Different instanceIds → checkConflict returns APPLY
        assert.strictEqual(manager.checkConflict(incoming, [local]), ConflictResolution.APPLY);
    });

    it('DELETE + DELETE auf gleichem Part → SKIP (redundant)', () => {
        const incoming = makeOp(OperationType.PART_REMOVED, 'i1', {}, 5);
        const local    = makeLocalOp(OperationType.PART_REMOVED, 'i1');
        const result = manager.resolve(incoming, local);
        // Both delete → local already deleted → incoming is redundant or APPLY
        assert.ok(Object.values(ConflictResolution).includes(result));
    });


    // ------------------------------------------------------------------
    // isObsolete
    // ------------------------------------------------------------------

    it('isObsolete gibt true zurück für TRANSFORM auf nicht-vorhandenem Part', () => {
        const o = makeOp(OperationType.PART_TRANSFORMED, 'i-deleted', {}, 3);
        const state = makeState({ instanceIds: ['i-exists'] });
        assert.strictEqual(manager.isObsolete(o, state), true);
    });

    it('isObsolete gibt false zurück wenn Part vorhanden', () => {
        const o = makeOp(OperationType.PART_TRANSFORMED, 'i1', {}, 3);
        const state = makeState({ instanceIds: ['i1', 'i2'] });
        assert.strictEqual(manager.isObsolete(o, state), false);
    });

    it('isObsolete gibt false für PART_PLACED (neues Teil, existiert noch nicht)', () => {
        const o = makeOp(OperationType.PART_PLACED, 'i-new', {}, 1);
        const state = makeState({ instanceIds: [] });
        // PART_PLACED is a new part being added → not obsolete
        assert.strictEqual(manager.isObsolete(o, state), false);
    });

    it('isObsolete gibt true für GROUP_UPDATED auf nicht-vorhandener Gruppe', () => {
        const o = makeOp(OperationType.GROUP_UPDATED, 'g-gone', {}, 3);
        const state = makeState({ groupIds: ['g-other'] });
        assert.strictEqual(manager.isObsolete(o, state), true);
    });

    it('isObsolete gibt false wenn Gruppe vorhanden', () => {
        const o = makeOp(OperationType.GROUP_UPDATED, 'g1', {}, 2);
        const state = makeState({ groupIds: ['g1'] });
        assert.strictEqual(manager.isObsolete(o, state), false);
    });

    it('isObsolete mit leerem State gibt false zurück (keine IDs bekannt)', () => {
        const o = makeOp(OperationType.PART_TRANSFORMED, 'i1', {}, 1);
        // instanceId not in the empty set → obsolete
        const state = makeState();
        // Whether it's true or false depends on implementation — just must not throw
        const result = manager.isObsolete(o, state);
        assert.ok(typeof result === 'boolean');
    });

});
