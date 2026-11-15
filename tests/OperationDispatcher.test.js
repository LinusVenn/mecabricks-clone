/**
 * Tests für OperationDispatcher (Phase J)
 *
 * Abdeckung:
 *  - dispatch: alle 11 Operation-Typen werden korrekt geroutet
 *  - Unbekannter Typ → false, kein Fehler
 *  - Fehlende Payload-Felder → false (graceful skip)
 *  - Fehlende Manager → false (graceful skip)
 *  - Editor-Fehler → false (graceful skip, kein throw)
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { OperationDispatcher } from '../src/collaboration/OperationDispatcher.js';
import { Operation, OperationType } from '../src/collaboration/OperationQueue.js';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOp(type, payload = {}) {
    return Operation.create(type, 'proj-1', 'u1', payload);
}

function makeEditor() {
    return {
        addPart:        mock.fn(async () => {}),
        removePart:     mock.fn(async () => {}),
        transformPart:  mock.fn(async () => {}),
        setPartColor:   mock.fn(async () => {}),
        setPartVariant: mock.fn(async () => {}),
    };
}

function makeGroupManager() {
    return {
        createGroup: mock.fn(async () => {}),
        updateGroup: mock.fn(async () => {}),
        removeGroup: mock.fn(async () => {}),
    };
}

function makeConnectionManager() {
    return {
        createConnection: mock.fn(async () => {}),
        removeConnection: mock.fn(async () => {}),
    };
}

function makeAssemblyManager() {
    return {
        updateAssembly: mock.fn(async () => {}),
    };
}

function buildDispatcher() {
    const editor      = makeEditor();
    const groups      = makeGroupManager();
    const connections = makeConnectionManager();
    const assembly    = makeAssemblyManager();

    const dispatcher = new OperationDispatcher({
        editor,
        library:           null,
        connectionManager: connections,
        groupManager:      groups,
        assemblyManager:   assembly,
    });

    return { dispatcher, editor, groups, connections, assembly };
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OperationDispatcher', () => {

    // ------------------------------------------------------------------
    // PART_PLACED
    // ------------------------------------------------------------------

    describe('PART_PLACED', () => {

        it('ruft editor.addPart auf', async () => {
            const { dispatcher, editor } = buildDispatcher();
            const op = makeOp(OperationType.PART_PLACED, { instanceId: 'i1', partId: 'p1' });

            const result = await dispatcher.dispatch(op);

            assert.equal(result, true);
            assert.equal(editor.addPart.mock.calls.length, 1);
            const arg = editor.addPart.mock.calls[0].arguments[0];
            assert.equal(arg.instanceId, 'i1');
            assert.equal(arg.partId, 'p1');
        });

        it('gibt false zurück wenn instanceId fehlt', async () => {
            const { dispatcher } = buildDispatcher();
            const op = makeOp(OperationType.PART_PLACED, { partId: 'p1' });
            const result = await dispatcher.dispatch(op);
            assert.equal(result, false);
        });

        it('gibt false zurück wenn kein Editor vorhanden', async () => {
            const dispatcher = new OperationDispatcher({});
            const op = makeOp(OperationType.PART_PLACED, { instanceId: 'i1', partId: 'p1' });
            const result = await dispatcher.dispatch(op);
            assert.equal(result, false);
        });

        it('gibt false zurück wenn addPart wirft', async () => {
            const { dispatcher, editor } = buildDispatcher();
            editor.addPart = mock.fn(async () => { throw new Error('Part not found'); });
            const op = makeOp(OperationType.PART_PLACED, { instanceId: 'i1', partId: 'p1' });
            const result = await dispatcher.dispatch(op);
            assert.equal(result, false);
        });
    });


    // ------------------------------------------------------------------
    // PART_REMOVED
    // ------------------------------------------------------------------

    describe('PART_REMOVED', () => {

        it('ruft editor.removePart auf', async () => {
            const { dispatcher, editor } = buildDispatcher();
            const op = makeOp(OperationType.PART_REMOVED, { instanceId: 'i1' });

            const result = await dispatcher.dispatch(op);

            assert.equal(result, true);
            assert.equal(editor.removePart.mock.calls[0].arguments[0], 'i1');
        });

        it('gibt false zurück wenn instanceId fehlt', async () => {
            const { dispatcher } = buildDispatcher();
            const op = makeOp(OperationType.PART_REMOVED, {});
            assert.equal(await dispatcher.dispatch(op), false);
        });
    });


    // ------------------------------------------------------------------
    // PART_TRANSFORMED
    // ------------------------------------------------------------------

    describe('PART_TRANSFORMED', () => {

        it('ruft editor.transformPart auf', async () => {
            const { dispatcher, editor } = buildDispatcher();
            const matrix = [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];
            const op = makeOp(OperationType.PART_TRANSFORMED, { instanceId: 'i1', matrix });

            const result = await dispatcher.dispatch(op);

            assert.equal(result, true);
            const [id, mat] = editor.transformPart.mock.calls[0].arguments;
            assert.equal(id, 'i1');
            assert.deepEqual(mat, matrix);
        });

        it('gibt false zurück wenn matrix fehlt', async () => {
            const { dispatcher } = buildDispatcher();
            const op = makeOp(OperationType.PART_TRANSFORMED, { instanceId: 'i1' });
            assert.equal(await dispatcher.dispatch(op), false);
        });
    });


    // ------------------------------------------------------------------
    // PART_COLOR_CHANGED
    // ------------------------------------------------------------------

    describe('PART_COLOR_CHANGED', () => {

        it('ruft editor.setPartColor auf', async () => {
            const { dispatcher, editor } = buildDispatcher();
            const op = makeOp(OperationType.PART_COLOR_CHANGED, { instanceId: 'i1', color: 15 });

            const result = await dispatcher.dispatch(op);

            assert.equal(result, true);
            assert.equal(editor.setPartColor.mock.calls[0].arguments[0], 'i1');
            assert.equal(editor.setPartColor.mock.calls[0].arguments[1], 15);
        });

        it('color=0 ist gültig (falsy check)', async () => {
            const { dispatcher, editor } = buildDispatcher();
            const op = makeOp(OperationType.PART_COLOR_CHANGED, { instanceId: 'i1', color: 0 });
            assert.equal(await dispatcher.dispatch(op), true);
        });
    });


    // ------------------------------------------------------------------
    // PART_VARIANT_CHANGED
    // ------------------------------------------------------------------

    describe('PART_VARIANT_CHANGED', () => {

        it('ruft editor.setPartVariant auf', async () => {
            const { dispatcher, editor } = buildDispatcher();
            const op = makeOp(OperationType.PART_VARIANT_CHANGED, { instanceId: 'i1', variant: 'printed' });

            const result = await dispatcher.dispatch(op);

            assert.equal(result, true);
            assert.equal(editor.setPartVariant.mock.calls[0].arguments[1], 'printed');
        });
    });


    // ------------------------------------------------------------------
    // GROUP_CREATED
    // ------------------------------------------------------------------

    describe('GROUP_CREATED', () => {

        it('ruft groups.createGroup auf', async () => {
            const { dispatcher, groups } = buildDispatcher();
            const op = makeOp(OperationType.GROUP_CREATED, { groupId: 'g1', name: 'Turm', instanceIds: ['i1', 'i2'] });

            const result = await dispatcher.dispatch(op);

            assert.equal(result, true);
            assert.equal(groups.createGroup.mock.calls.length, 1);
        });

        it('gibt false zurück wenn groupId fehlt', async () => {
            const { dispatcher } = buildDispatcher();
            const op = makeOp(OperationType.GROUP_CREATED, { name: 'Turm' });
            assert.equal(await dispatcher.dispatch(op), false);
        });

        it('gibt false zurück wenn kein groupManager', async () => {
            const dispatcher = new OperationDispatcher({ editor: makeEditor() });
            const op = makeOp(OperationType.GROUP_CREATED, { groupId: 'g1' });
            assert.equal(await dispatcher.dispatch(op), false);
        });
    });


    // ------------------------------------------------------------------
    // GROUP_UPDATED
    // ------------------------------------------------------------------

    describe('GROUP_UPDATED', () => {

        it('ruft groups.updateGroup auf', async () => {
            const { dispatcher, groups } = buildDispatcher();
            const op = makeOp(OperationType.GROUP_UPDATED, { groupId: 'g1', updates: { name: 'Burg' } });

            assert.equal(await dispatcher.dispatch(op), true);
            assert.equal(groups.updateGroup.mock.calls[0].arguments[0], 'g1');
        });
    });


    // ------------------------------------------------------------------
    // GROUP_REMOVED
    // ------------------------------------------------------------------

    describe('GROUP_REMOVED', () => {

        it('ruft groups.removeGroup auf', async () => {
            const { dispatcher, groups } = buildDispatcher();
            const op = makeOp(OperationType.GROUP_REMOVED, { groupId: 'g1' });

            assert.equal(await dispatcher.dispatch(op), true);
            assert.equal(groups.removeGroup.mock.calls[0].arguments[0], 'g1');
        });
    });


    // ------------------------------------------------------------------
    // CONNECTION_CREATED
    // ------------------------------------------------------------------

    describe('CONNECTION_CREATED', () => {

        it('ruft connections.createConnection auf', async () => {
            const { dispatcher, connections } = buildDispatcher();
            const op = makeOp(OperationType.CONNECTION_CREATED, {
                connectionId: 'c1', fromInstanceId: 'i1', toInstanceId: 'i2'
            });

            assert.equal(await dispatcher.dispatch(op), true);
            assert.equal(connections.createConnection.mock.calls.length, 1);
        });

        it('gibt false zurück wenn connectionId fehlt', async () => {
            const { dispatcher } = buildDispatcher();
            const op = makeOp(OperationType.CONNECTION_CREATED, {});
            assert.equal(await dispatcher.dispatch(op), false);
        });

        it('gibt false zurück wenn kein connectionManager', async () => {
            const dispatcher = new OperationDispatcher({ editor: makeEditor() });
            const op = makeOp(OperationType.CONNECTION_CREATED, { connectionId: 'c1' });
            assert.equal(await dispatcher.dispatch(op), false);
        });
    });


    // ------------------------------------------------------------------
    // CONNECTION_REMOVED
    // ------------------------------------------------------------------

    describe('CONNECTION_REMOVED', () => {

        it('ruft connections.removeConnection auf', async () => {
            const { dispatcher, connections } = buildDispatcher();
            const op = makeOp(OperationType.CONNECTION_REMOVED, { connectionId: 'c1' });

            assert.equal(await dispatcher.dispatch(op), true);
            assert.equal(connections.removeConnection.mock.calls[0].arguments[0], 'c1');
        });
    });


    // ------------------------------------------------------------------
    // ASSEMBLY_UPDATED
    // ------------------------------------------------------------------

    describe('ASSEMBLY_UPDATED', () => {

        it('ruft assembly.updateAssembly auf', async () => {
            const { dispatcher, assembly } = buildDispatcher();
            const op = makeOp(OperationType.ASSEMBLY_UPDATED, { items: ['a', 'b'] });

            assert.equal(await dispatcher.dispatch(op), true);
            assert.equal(assembly.updateAssembly.mock.calls.length, 1);
        });

        it('gibt false zurück wenn kein assemblyManager', async () => {
            const dispatcher = new OperationDispatcher({ editor: makeEditor() });
            const op = makeOp(OperationType.ASSEMBLY_UPDATED, { items: [] });
            assert.equal(await dispatcher.dispatch(op), false);
        });
    });


    // ------------------------------------------------------------------
    // Unbekannter Typ
    // ------------------------------------------------------------------

    describe('Unbekannter Typ', () => {

        it('gibt false zurück ohne Fehler zu werfen', async () => {
            const { dispatcher } = buildDispatcher();
            const op = new (class extends Operation { get type() { return 'UNKNOWN_OP'; } })(
                { type: 'UNKNOWN_OP', operationId: crypto.randomUUID(), projectId: 'p', userId: 'u', payload: {} }
            );
            const result = await dispatcher.dispatch(op);
            assert.equal(result, false);
        });
    });
});
