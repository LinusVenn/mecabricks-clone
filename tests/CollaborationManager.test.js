/**
 * Tests für CollaborationManager (Phase J)
 *
 * Abdeckung:
 *  - Konstruktor: Pflichtparameter-Validierung
 *  - joinProject: loadRole + connect + presence.start + State-Update
 *  - leaveProject: presence.stop + disconnect + queue.clear + clearRole
 *  - sendOperation: Permission-Check, Enqueue, Transport.send
 *  - _handleIncomingMessage: eigene Ops (acknowledge), fremde Ops (dispatch)
 *  - Konfliktlösung: SKIP führt zu keinem Dispatch
 *  - subscribe / unsubscribe
 *  - destroy
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { CollaborationManager }           from '../src/collaboration/CollaborationManager.js';
import { CollaborationState, CollaborationRole } from '../src/collaboration/CollaborationState.js';
import { Operation, OperationQueue, OperationType } from '../src/collaboration/OperationQueue.js';
import { ConflictResolution }             from '../src/collaboration/ConflictManager.js';
import { TransportStatus }                from '../src/collaboration/CollaborationTransport.js';


// ─── Fake-Infrastruktur ────────────────────────────────────────────────────────

function makeSupabase() {
    return { auth: { getSession: async () => ({ data: { session: null } }) } };
}

function makeAuth(userId = 'u1') {
    return { currentUser: { id: userId, email: 'test@example.com' } };
}

function makePermissions(role = CollaborationRole.EDITOR) {
    return {
        loadRole:  mock.fn(async () => role),
        clearRole: mock.fn(),
    };
}

function makeTransport() {
    const messageHandlers = new Set();
    const statusHandlers  = new Set();
    return {
        connect:        mock.fn(async () => {}),
        disconnect:     mock.fn(async () => {}),
        send:           mock.fn(() => {}),
        onMessage:      (cb) => { messageHandlers.add(cb); return () => messageHandlers.delete(cb); },
        onStatusChange: (cb) => { statusHandlers.add(cb);  return () => statusHandlers.delete(cb); },
        _emitMessage:   (msg) => messageHandlers.forEach(cb => cb(msg)),
        _emitStatus:    (s)   => statusHandlers.forEach(cb => cb(s)),
    };
}

function makeDispatcher(result = true) {
    return { dispatch: mock.fn(async () => result) };
}

function makeConflictManager(resolution = ConflictResolution.APPLY) {
    return { checkConflict: mock.fn(() => resolution) };
}

function makePresence() {
    return {
        start: mock.fn(async () => {}),
        stop:  mock.fn(async () => {}),
    };
}

function makeQueue() {
    const queue = new OperationQueue({ maxSize: 50 });
    return queue;
}

function buildManager({
    role       = CollaborationRole.EDITOR,
    resolution = ConflictResolution.APPLY,
    dispResult = true,
} = {}) {
    const supabase    = makeSupabase();
    const auth        = makeAuth();
    const permissions = makePermissions(role);
    const transport   = makeTransport();
    const queue       = makeQueue();
    const dispatcher  = makeDispatcher(dispResult);
    const conflicts   = makeConflictManager(resolution);
    const presence    = makePresence();

    const manager = new CollaborationManager({
        supabaseClient:    supabase,
        authManager:       auth,
        projectManager:    null,
        cloudSyncManager:  null,
        permissionManager: permissions,
        sharingManager:    null,
        versionManager:    null,
        operationQueue:    queue,
        transport,
        dispatcher,
        conflictManager:   conflicts,
        presenceManager:   presence,
    });

    return { manager, auth, permissions, transport, queue, dispatcher, conflicts, presence };
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollaborationManager', () => {

    // ------------------------------------------------------------------
    // Konstruktor
    // ------------------------------------------------------------------

    describe('Konstruktor', () => {

        it('wirft ohne supabaseClient', () => {
            assert.throws(
                () => new CollaborationManager({
                    supabaseClient:    null,
                    authManager:       makeAuth(),
                    permissionManager: makePermissions(),
                    operationQueue:    makeQueue(),
                    transport:         makeTransport(),
                    dispatcher:        makeDispatcher(),
                    conflictManager:   makeConflictManager(),
                }),
                /supabaseClient is required/
            );
        });

        it('wirft ohne authManager', () => {
            assert.throws(
                () => new CollaborationManager({
                    supabaseClient:    makeSupabase(),
                    authManager:       null,
                    permissionManager: makePermissions(),
                    operationQueue:    makeQueue(),
                    transport:         makeTransport(),
                    dispatcher:        makeDispatcher(),
                    conflictManager:   makeConflictManager(),
                }),
                /authManager is required/
            );
        });

        it('startet mit createLocal()-State', () => {
            const { manager } = buildManager();
            assert.equal(manager.state.isConnected, false);
            assert.equal(manager.state.projectId, null);
            assert.equal(manager.isCollaborating, false);
        });
    });


    // ------------------------------------------------------------------
    // joinProject
    // ------------------------------------------------------------------

    describe('joinProject', () => {

        it('lädt Rolle, verbindet Transport und startet Presence', async () => {
            const { manager, permissions, transport, presence } = buildManager();

            await manager.joinProject('proj-1');

            assert.equal(permissions.loadRole.mock.calls.length, 1);
            assert.equal(transport.connect.mock.calls.length, 1);
            assert.equal(presence.start.mock.calls.length, 1);
        });

        it('setzt State auf verbunden mit korrekter projectId', async () => {
            const { manager } = buildManager({ role: CollaborationRole.OWNER });

            await manager.joinProject('proj-1');

            const state = manager.state;
            assert.equal(state.projectId, 'proj-1');
            assert.equal(state.isConnected, true);
            assert.equal(state.role, CollaborationRole.OWNER);
            assert.equal(manager.isCollaborating, true);
        });

        it('wirft wenn kein User eingeloggt', async () => {
            const supabase    = makeSupabase();
            const auth        = { currentUser: null };
            const manager     = new CollaborationManager({
                supabaseClient:    supabase,
                authManager:       auth,
                permissionManager: makePermissions(),
                operationQueue:    makeQueue(),
                transport:         makeTransport(),
                dispatcher:        makeDispatcher(),
                conflictManager:   makeConflictManager(),
            });

            await assert.rejects(() => manager.joinProject('proj-1'), /must be logged in/);
        });
    });


    // ------------------------------------------------------------------
    // leaveProject
    // ------------------------------------------------------------------

    describe('leaveProject', () => {

        it('stoppt Presence, trennt Transport, löscht Queue und Rolle', async () => {
            const { manager, transport, queue, permissions, presence } = buildManager();

            await manager.joinProject('proj-1');

            // Add an op to the queue
            queue.enqueue(Operation.create(OperationType.PART_PLACED, 'proj-1', 'u1', { instanceId: 'i1' }));
            assert.equal(queue.size, 1);

            await manager.leaveProject();

            assert.equal(transport.disconnect.mock.calls.length, 1);
            assert.equal(presence.stop.mock.calls.length, 1);
            assert.equal(permissions.clearRole.mock.calls.length, 1);
            assert.equal(queue.size, 0);
        });

        it('setzt State zurück auf local', async () => {
            const { manager } = buildManager();
            await manager.joinProject('proj-1');
            await manager.leaveProject();

            assert.equal(manager.state.isConnected, false);
            assert.equal(manager.state.projectId, null);
            assert.equal(manager.isCollaborating, false);
        });
    });


    // ------------------------------------------------------------------
    // sendOperation
    // ------------------------------------------------------------------

    describe('sendOperation', () => {

        it('enqueue + Transport.send bei canEdit', async () => {
            const { manager, transport, queue } = buildManager({ role: CollaborationRole.EDITOR });
            await manager.joinProject('proj-1');

            await manager.sendOperation(OperationType.PART_PLACED, { instanceId: 'i1' });

            assert.equal(queue.size, 1);
            assert.equal(transport.send.mock.calls.length, 1);
        });

        it('wirft bei role=VIEWER (kein canEdit)', async () => {
            const { manager } = buildManager({ role: CollaborationRole.VIEWER });
            await manager.joinProject('proj-1');

            await assert.rejects(
                () => manager.sendOperation(OperationType.PART_PLACED, { instanceId: 'i1' }),
                /insufficient permissions/
            );
        });

        it('Transport.send wird mit kind=OPERATION aufgerufen', async () => {
            const { manager, transport } = buildManager();
            await manager.joinProject('proj-1');
            await manager.sendOperation(OperationType.PART_PLACED, { instanceId: 'i1' });

            const sentArg = transport.send.mock.calls[0].arguments[0];
            assert.equal(sentArg.kind, 'OPERATION');
        });
    });


    // ------------------------------------------------------------------
    // Eingehende Nachrichten – eigene Op (Echo)
    // ------------------------------------------------------------------

    describe('eigene Ops (Echo/Acknowledge)', () => {

        it('eigene Op wird acknowledged und nicht dispatcht', async () => {
            const { manager, transport, queue, dispatcher } = buildManager();
            await manager.joinProject('proj-1');

            const op = await manager.sendOperation(OperationType.PART_PLACED, { instanceId: 'i1' });

            // Server echo mit sequenceNumber
            transport._emitMessage({
                kind:           'OPERATION',
                userId:         'u1',
                operationId:    op.operationId,
                type:           op.type,
                projectId:      op.projectId,
                payload:        op.payload,
                sequenceNumber: 42,
            });

            // Kurz warten (Promise wird intern awaited)
            await new Promise(r => setTimeout(r, 0));

            assert.equal(dispatcher.dispatch.mock.calls.length, 0);
            const acked = queue.pending.find(o => o.operationId === op.operationId);
            assert.equal(acked, undefined); // acknowledged → nicht mehr pending
        });
    });


    // ------------------------------------------------------------------
    // Eingehende Nachrichten – fremde Op
    // ------------------------------------------------------------------

    describe('fremde Ops', () => {

        it('fremde Op wird dispatcht wenn APPLY', async () => {
            const { manager, transport, dispatcher } = buildManager({ resolution: ConflictResolution.APPLY });
            await manager.joinProject('proj-1');

            transport._emitMessage({
                kind:           'OPERATION',
                userId:         'u2',
                operationId:    'remote-op-1',
                type:           OperationType.PART_PLACED,
                projectId:      'proj-1',
                userId:         'u2',
                payload:        { instanceId: 'i2' },
                sequenceNumber: 5,
            });

            await new Promise(r => setTimeout(r, 0));

            assert.equal(dispatcher.dispatch.mock.calls.length, 1);
        });

        it('fremde Op wird NICHT dispatcht wenn SKIP', async () => {
            const { manager, transport, dispatcher } = buildManager({ resolution: ConflictResolution.SKIP });
            await manager.joinProject('proj-1');

            // Lokale pending Op auf dasselbe Ziel
            const localOp = Operation.create(
                OperationType.PART_REMOVED, 'proj-1', 'u1', { instanceId: 'i1' }
            );
            manager._queue.enqueue(localOp);

            transport._emitMessage({
                kind:           'OPERATION',
                userId:         'u2',
                operationId:    'remote-op-2',
                type:           OperationType.PART_TRANSFORMED,
                projectId:      'proj-1',
                payload:        { instanceId: 'i1', matrix: [] },
                sequenceNumber: 7,
            });

            await new Promise(r => setTimeout(r, 0));

            assert.equal(dispatcher.dispatch.mock.calls.length, 0);
        });

        it('PING und CURSOR werden ignoriert (kein Dispatch)', async () => {
            const { manager, transport, dispatcher } = buildManager();
            await manager.joinProject('proj-1');

            transport._emitMessage({ kind: 'PING' });
            transport._emitMessage({ kind: 'CURSOR', userId: 'u2' });

            await new Promise(r => setTimeout(r, 0));

            assert.equal(dispatcher.dispatch.mock.calls.length, 0);
        });
    });


    // ------------------------------------------------------------------
    // Transport-Status
    // ------------------------------------------------------------------

    describe('Transport-Status', () => {

        it('isConnected-State folgt TransportStatus', async () => {
            const { manager, transport } = buildManager();
            await manager.joinProject('proj-1');

            assert.equal(manager.state.isConnected, true);

            transport._emitStatus(TransportStatus.DISCONNECTED);
            assert.equal(manager.state.isConnected, false);

            transport._emitStatus(TransportStatus.CONNECTED);
            assert.equal(manager.state.isConnected, true);
        });
    });


    // ------------------------------------------------------------------
    // subscribe / unsubscribe
    // ------------------------------------------------------------------

    describe('subscribe', () => {

        it('Subscriber wird bei State-Änderung benachrichtigt', async () => {
            const { manager } = buildManager();
            const received = [];
            manager.subscribe(s => received.push(s));

            await manager.joinProject('proj-1');

            assert.ok(received.length > 0);
            assert.ok(received.every(s => s instanceof CollaborationState));
        });

        it('Unsubscribe verhindert weitere Benachrichtigungen', async () => {
            const { manager } = buildManager();
            const received = [];
            const unsub = manager.subscribe(s => received.push(s));

            await manager.joinProject('proj-1');
            const countAfterJoin = received.length;

            unsub();
            await manager.leaveProject();

            assert.equal(received.length, countAfterJoin);
        });
    });


    // ------------------------------------------------------------------
    // destroy
    // ------------------------------------------------------------------

    describe('destroy', () => {

        it('destroy entfernt Transport-Listener ohne Fehler', () => {
            const { manager } = buildManager();
            assert.doesNotThrow(() => manager.destroy());
        });
    });
});
