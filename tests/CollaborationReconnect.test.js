/**
 * Tests für Reconnect- und Replay-Logik (Phase J)
 *
 * Abdeckung:
 *  - getPendingAfter: gibt Ops zurück die nach einer bestimmten seqNr. ausstehen
 *  - Replay-Szenario: nach Verbindungsverlust werden nur unbestätigte Ops erneut gesendet
 *  - Acknowledged Ops tauchen nicht mehr in getPendingAfter auf
 *  - getPendingAfter(null) gibt alle unbestätigten zurück
 *  - Transport-Statuswechsel DISCONNECTED → isConnected=false im CollaborationManager
 *  - Ops die während der Unterbrechung ankamen werden nach Reconnect korrekt dispatcht
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { Operation, OperationQueue, OperationType } from '../src/collaboration/OperationQueue.js';
import { CollaborationManager } from '../src/collaboration/CollaborationManager.js';
import { CollaborationRole }    from '../src/collaboration/CollaborationState.js';
import { ConflictResolution }   from '../src/collaboration/ConflictManager.js';
import { TransportStatus }      from '../src/collaboration/CollaborationTransport.js';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOp(type, payload = {}, seqNum = null) {
    const op = Operation.create(type, 'proj-1', 'u1', payload);
    return seqNum !== null ? op.acknowledge(seqNum) : op;
}


// ─── OperationQueue.getPendingAfter ───────────────────────────────────────────

describe('OperationQueue.getPendingAfter – Replay-Logik', () => {

    let queue;

    beforeEach(() => {
        queue = new OperationQueue({ maxSize: 100 });
    });


    it('getPendingAfter(null) gibt alle unbestätigten Ops zurück', () => {
        const a = makeOp(OperationType.PART_PLACED, { instanceId: 'i1' });
        const b = makeOp(OperationType.PART_PLACED, { instanceId: 'i2' });
        queue.enqueue(a);
        queue.enqueue(b);

        const result = queue.getPendingAfter(null);
        assert.equal(result.length, 2);
    });

    it('getPendingAfter(0) gibt alle zurück wenn sequenceNumber null (unbestätigt)', () => {
        queue.enqueue(makeOp(OperationType.PART_PLACED, { instanceId: 'i1' }));
        queue.enqueue(makeOp(OperationType.PART_PLACED, { instanceId: 'i2' }));

        const result = queue.getPendingAfter(0);
        assert.equal(result.length, 2); // null seq. counts as "after" threshold
    });

    it('acknowledged Ops erscheinen nicht in getPendingAfter', () => {
        const op = makeOp(OperationType.PART_PLACED, { instanceId: 'i1' });
        queue.enqueue(op);

        // Acknowledge
        queue.acknowledge(op.operationId, 5);

        const result = queue.getPendingAfter(null);
        assert.equal(result.length, 0);
    });

    it('filtert korrekt nach sequenceNumber', () => {
        // Op A: seqNum 3 (acknowledged)
        const a = makeOp(OperationType.PART_PLACED, { instanceId: 'i1' });
        queue.enqueue(a);
        queue.acknowledge(a.operationId, 3);

        // Op B: seqNum 7 (acknowledged)
        const b = makeOp(OperationType.PART_PLACED, { instanceId: 'i2' });
        queue.enqueue(b);
        queue.acknowledge(b.operationId, 7);

        // Op C: pending (null seqNum)
        const c = makeOp(OperationType.PART_PLACED, { instanceId: 'i3' });
        queue.enqueue(c);

        // getPendingAfter(5): B hat seqNum 7 > 5, aber B ist acknowledged → nicht pending
        // C ist pending (null) → wird returned
        const result = queue.getPendingAfter(5);
        assert.equal(result.length, 1);
        assert.equal(result[0].operationId, c.operationId);
    });

    it('Replay-Szenario: nach Trennung nur neue Ops erneut senden', () => {
        // Vor der Trennung: 3 Ops, davon 2 confirmed
        const a = makeOp(OperationType.PART_PLACED, { instanceId: 'i1' });
        const b = makeOp(OperationType.PART_PLACED, { instanceId: 'i2' });
        const c = makeOp(OperationType.PART_PLACED, { instanceId: 'i3' });

        queue.enqueue(a);
        queue.enqueue(b);
        queue.enqueue(c);

        queue.acknowledge(a.operationId, 10);
        queue.acknowledge(b.operationId, 11);
        // c bleibt unbestätigt

        // Reconnect: letzter bekannter seqNum = 11
        const toResend = queue.getPendingAfter(11);

        assert.equal(toResend.length, 1);
        assert.equal(toResend[0].operationId, c.operationId);
    });

    it('leere Queue → getPendingAfter gibt [] zurück', () => {
        assert.deepEqual(queue.getPendingAfter(null), []);
        assert.deepEqual(queue.getPendingAfter(99), []);
    });
});


// ─── Reconnect im CollaborationManager ───────────────────────────────────────

describe('CollaborationManager – Reconnect-Verhalten', () => {

    function buildManager() {
        const messageHandlers = new Set();
        const statusHandlers  = new Set();
        const supabase        = { auth: { getSession: async () => ({ data: { session: null } }) } };
        const auth            = { currentUser: { id: 'u1', email: 't@t.de' } };
        const permissions     = { loadRole: mock.fn(async () => CollaborationRole.EDITOR), clearRole: mock.fn() };
        const transport       = {
            connect:        mock.fn(async () => {}),
            disconnect:     mock.fn(async () => {}),
            send:           mock.fn(() => {}),
            onMessage:      (cb) => { messageHandlers.add(cb); return () => messageHandlers.delete(cb); },
            onStatusChange: (cb) => { statusHandlers.add(cb);  return () => statusHandlers.delete(cb); },
            _emitMessage:   (msg) => messageHandlers.forEach(cb => cb(msg)),
            _emitStatus:    (s)   => statusHandlers.forEach(cb => cb(s)),
        };
        const queue      = new OperationQueue({ maxSize: 50 });
        const dispatcher = { dispatch: mock.fn(async () => true) };
        const conflicts  = { checkConflict: mock.fn(() => ConflictResolution.APPLY) };
        const presence   = { start: mock.fn(async () => {}), stop: mock.fn(async () => {}) };

        const manager = new CollaborationManager({
            supabaseClient: supabase, authManager: auth, projectManager: null,
            cloudSyncManager: null, permissionManager: permissions, sharingManager: null,
            versionManager: null, operationQueue: queue, transport, dispatcher,
            conflictManager: conflicts, presenceManager: presence,
        });

        return { manager, transport, queue, dispatcher };
    }


    it('State isConnected=false nach DISCONNECTED vom Transport', async () => {
        const { manager, transport } = buildManager();
        await manager.joinProject('proj-1');

        assert.equal(manager.state.isConnected, true);

        transport._emitStatus(TransportStatus.DISCONNECTED);

        assert.equal(manager.state.isConnected, false);
    });

    it('State isConnected=true nach erneutem CONNECTED', async () => {
        const { manager, transport } = buildManager();
        await manager.joinProject('proj-1');

        transport._emitStatus(TransportStatus.DISCONNECTED);
        transport._emitStatus(TransportStatus.CONNECTED);

        assert.equal(manager.state.isConnected, true);
    });

    it('unbestätigte Ops bleiben in der Queue nach Trennung', async () => {
        const { manager, transport, queue } = buildManager();
        await manager.joinProject('proj-1');

        // 2 Ops senden (bleiben pending)
        await manager.sendOperation(OperationType.PART_PLACED, { instanceId: 'i1' });
        await manager.sendOperation(OperationType.PART_PLACED, { instanceId: 'i2' });

        assert.equal(queue.size, 2);

        transport._emitStatus(TransportStatus.DISCONNECTED);

        // Queue darf beim Disconnect nicht geleert werden (nur beim leaveProject)
        assert.equal(queue.size, 2);
    });

    it('getPendingAfter gibt korrekte Ops für Replay zurück', async () => {
        const { manager, transport, queue } = buildManager();
        await manager.joinProject('proj-1');

        const op1 = await manager.sendOperation(OperationType.PART_PLACED, { instanceId: 'i1' });
        const op2 = await manager.sendOperation(OperationType.PART_PLACED, { instanceId: 'i2' });

        // Server bestätigt op1 mit seqNr 1
        transport._emitMessage({
            kind: 'OPERATION', userId: 'u1', operationId: op1.operationId,
            type: op1.type, projectId: 'proj-1', payload: op1.payload, sequenceNumber: 1,
        });
        await new Promise(r => setTimeout(r, 0));

        // Nach Reconnect: getPendingAfter(1) liefert nur op2
        const toReplay = queue.getPendingAfter(1);
        assert.equal(toReplay.length, 1);
        assert.equal(toReplay[0].operationId, op2.operationId);
    });

    it('eingehende Op nach Reconnect wird normal dispatcht', async () => {
        const { manager, transport, dispatcher } = buildManager();
        await manager.joinProject('proj-1');

        // Kurze Trennung
        transport._emitStatus(TransportStatus.DISCONNECTED);
        transport._emitStatus(TransportStatus.CONNECTED);

        // Jetzt kommt eine Op von einem anderen Client
        transport._emitMessage({
            kind: 'OPERATION', userId: 'u2', operationId: 'remote-1',
            type: OperationType.PART_PLACED, projectId: 'proj-1',
            payload: { instanceId: 'i5' }, sequenceNumber: 10,
        });
        await new Promise(r => setTimeout(r, 0));

        assert.equal(dispatcher.dispatch.mock.calls.length, 1);
    });
});
