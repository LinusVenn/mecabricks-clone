/**
 * Tests für OperationQueue + Operation + OperationType (Phase J – Kollaboration)
 *
 * Reine Logik – keine Mocks notwendig.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    Operation,
    OperationQueue,
    OperationType,
} from '../src/collaboration/OperationQueue.js';

const PROJECT = 'project-uuid-1';
const USER    = 'user-uuid-1';

/** Hilfsfunktion: Operation mit Standardwerten erstellen */
function op(type, payload = {}) {
    return Operation.create(type, PROJECT, USER, payload);
}


// -----------------------------------------------------------------------
// Tests: OperationType Konstanten
// -----------------------------------------------------------------------

describe('OperationType', () => {

    it('PART_PLACED ist definiert',         () => assert.ok(OperationType.PART_PLACED         !== undefined));
    it('PART_REMOVED ist definiert',        () => assert.ok(OperationType.PART_REMOVED        !== undefined));
    it('PART_TRANSFORMED ist definiert',    () => assert.ok(OperationType.PART_TRANSFORMED    !== undefined));
    it('PART_COLOR_CHANGED ist definiert',  () => assert.ok(OperationType.PART_COLOR_CHANGED  !== undefined));
    it('GROUP_CREATED ist definiert',       () => assert.ok(OperationType.GROUP_CREATED       !== undefined));
    it('GROUP_REMOVED ist definiert',       () => assert.ok(OperationType.GROUP_REMOVED       !== undefined));
    it('GROUP_UPDATED ist definiert',       () => assert.ok(OperationType.GROUP_UPDATED       !== undefined));
    it('CONNECTION_CREATED ist definiert',  () => assert.ok(OperationType.CONNECTION_CREATED  !== undefined));
    it('CONNECTION_REMOVED ist definiert',  () => assert.ok(OperationType.CONNECTION_REMOVED  !== undefined));
    it('ASSEMBLY_UPDATED ist definiert',    () => assert.ok(OperationType.ASSEMBLY_UPDATED    !== undefined));

});


// -----------------------------------------------------------------------
// Tests: Operation
// -----------------------------------------------------------------------

describe('Operation', () => {

    it('create gibt ein Operation-Objekt zurück', () => {
        const o = op(OperationType.PART_TRANSFORMED, { instanceId: 'i1' });
        assert.ok(o !== null && o !== undefined);
    });

    it('create generiert eindeutige operationId', () => {
        const o1 = op(OperationType.PART_TRANSFORMED, { instanceId: 'i1' });
        const o2 = op(OperationType.PART_TRANSFORMED, { instanceId: 'i1' });
        assert.notStrictEqual(o1.operationId, o2.operationId);
    });

    it('create setzt type korrekt', () => {
        const o = op(OperationType.PART_COLOR_CHANGED, { instanceId: 'i1', color: 'red' });
        assert.strictEqual(o.type, OperationType.PART_COLOR_CHANGED);
    });

    it('create setzt projectId korrekt', () => {
        const o = op(OperationType.PART_REMOVED, { instanceId: 'brick-42' });
        assert.strictEqual(o.projectId, PROJECT);
    });

    it('create setzt userId korrekt', () => {
        const o = op(OperationType.PART_PLACED, { instanceId: 'i1' });
        assert.strictEqual(o.userId, USER);
    });

    it('create setzt payload korrekt', () => {
        const payload = { instanceId: 'i1', x: 10, y: 20 };
        const o = op(OperationType.PART_TRANSFORMED, payload);
        assert.deepEqual(o.payload, payload);
    });

    it('isAcknowledged ist initial false', () => {
        const o = op(OperationType.PART_PLACED, {});
        assert.strictEqual(o.isAcknowledged, false);
    });

    it('sequenceNumber ist initial null', () => {
        const o = op(OperationType.PART_PLACED, {});
        assert.strictEqual(o.sequenceNumber, null);
    });

    it('acknowledge gibt neue Operation mit isAcknowledged=true zurück', () => {
        const o   = op(OperationType.PART_TRANSFORMED, {});
        const ack = o.acknowledge(5);
        assert.strictEqual(ack.isAcknowledged, true);
    });

    it('acknowledge setzt sequenceNumber', () => {
        const o   = op(OperationType.PART_TRANSFORMED, {});
        const ack = o.acknowledge(7);
        assert.strictEqual(ack.sequenceNumber, 7);
    });

    it('acknowledge mutiert das ursprüngliche Objekt nicht', () => {
        const o = op(OperationType.PART_TRANSFORMED, {});
        o.acknowledge(3);
        assert.strictEqual(o.isAcknowledged, false);
        assert.strictEqual(o.sequenceNumber, null);
    });

    it('acknowledge preserviert alle anderen Felder', () => {
        const original = op(OperationType.PART_COLOR_CHANGED, { instanceId: 'i9', color: 'blue' });
        const ack      = original.acknowledge(42);
        assert.strictEqual(ack.type,      original.type);
        assert.strictEqual(ack.projectId, original.projectId);
        assert.strictEqual(ack.userId,    original.userId);
        assert.deepEqual(ack.payload,     original.payload);
    });

    it('toJSON gibt ein Plain-Object zurück', () => {
        const o    = op(OperationType.PART_PLACED, { instanceId: 'i1' });
        const json = o.toJSON();
        assert.strictEqual(json.type,           OperationType.PART_PLACED);
        assert.strictEqual(json.projectId,      PROJECT);
        assert.strictEqual(json.userId,         USER);
        assert.strictEqual(json.sequenceNumber, null);
    });

    it('fromJSON stellt Operation wieder her', () => {
        const original = op(OperationType.PART_REMOVED, { instanceId: 'i2' }).acknowledge(10);
        const restored = Operation.fromJSON(original.toJSON());
        assert.strictEqual(restored.type,           original.type);
        assert.strictEqual(restored.operationId,    original.operationId);
        assert.strictEqual(restored.sequenceNumber, original.sequenceNumber);
        assert.deepEqual(restored.payload,          original.payload);
    });

});


// -----------------------------------------------------------------------
// Tests: OperationQueue
// -----------------------------------------------------------------------

describe('OperationQueue', () => {

    let queue;

    beforeEach(() => {
        queue = new OperationQueue();
    });


    // ------------------------------------------------------------------
    // Grundzustand
    // ------------------------------------------------------------------

    it('size ist 0 für leere Queue', () => {
        assert.strictEqual(queue.size, 0);
    });

    it('pending ist leer für leere Queue', () => {
        assert.strictEqual([...queue.pending].length, 0);
    });


    // ------------------------------------------------------------------
    // enqueue
    // ------------------------------------------------------------------

    it('enqueue fügt eine Operation hinzu', () => {
        queue.enqueue(op(OperationType.PART_TRANSFORMED, {}));
        assert.strictEqual(queue.size, 1);
    });

    it('enqueue mehrerer Operationen', () => {
        queue.enqueue(op(OperationType.PART_TRANSFORMED,   { instanceId: 'i1' }));
        queue.enqueue(op(OperationType.PART_COLOR_CHANGED, { instanceId: 'i2' }));
        queue.enqueue(op(OperationType.PART_REMOVED,       { instanceId: 'i3' }));
        assert.strictEqual(queue.size, 3);
    });

    it('has() gibt true zurück nach enqueue', () => {
        const o = op(OperationType.PART_PLACED, {});
        queue.enqueue(o);
        assert.strictEqual(queue.has(o.operationId), true);
    });


    // ------------------------------------------------------------------
    // dequeue
    // ------------------------------------------------------------------

    it('dequeue entfernt eine Operation per ID', () => {
        const o = op(OperationType.PART_PLACED, {});
        queue.enqueue(o);
        queue.dequeue(o.operationId);
        assert.strictEqual(queue.size, 0);
    });

    it('dequeue entfernt nur die angegebene Operation', () => {
        const o1 = op(OperationType.PART_TRANSFORMED, { instanceId: 'i1' });
        const o2 = op(OperationType.PART_TRANSFORMED, { instanceId: 'i2' });
        queue.enqueue(o1);
        queue.enqueue(o2);
        queue.dequeue(o1.operationId);
        assert.strictEqual(queue.size, 1);
        assert.strictEqual(queue.has(o2.operationId), true);
    });


    // ------------------------------------------------------------------
    // acknowledge
    // ------------------------------------------------------------------

    it('acknowledge markiert Operation als bestätigt', () => {
        const o = op(OperationType.PART_TRANSFORMED, {});
        queue.enqueue(o);
        queue.acknowledge(o.operationId, 1);
        const found = [...queue.pending].find(x => x.operationId === o.operationId);
        assert.ok(!found, 'Anerkannte Operation darf nicht in pending sein');
    });


    // ------------------------------------------------------------------
    // pending
    // ------------------------------------------------------------------

    it('pending gibt nur nicht-bestätigte Operationen zurück', () => {
        const o1 = op(OperationType.PART_TRANSFORMED,   { instanceId: 'i1' });
        const o2 = op(OperationType.PART_COLOR_CHANGED, { instanceId: 'i2' });
        queue.enqueue(o1);
        queue.enqueue(o2);
        queue.acknowledge(o1.operationId, 1);
        const p = [...queue.pending];
        assert.strictEqual(p.length, 1);
        assert.strictEqual(p[0].operationId, o2.operationId);
    });

    it('pending ist leer wenn alle Operationen bestätigt sind', () => {
        const o = op(OperationType.PART_PLACED, {});
        queue.enqueue(o);
        queue.acknowledge(o.operationId, 1);
        assert.strictEqual([...queue.pending].length, 0);
    });


    // ------------------------------------------------------------------
    // getPendingAfter
    // ------------------------------------------------------------------

    it('getPendingAfter gibt Array zurück', () => {
        const o1 = op(OperationType.PART_TRANSFORMED, { instanceId: 'i1' });
        const o2 = op(OperationType.PART_TRANSFORMED, { instanceId: 'i2' });
        queue.enqueue(o1);
        queue.enqueue(o2);
        queue.acknowledge(o1.operationId, 1);
        const after = queue.getPendingAfter(0);
        assert.ok(Array.isArray(after));
    });

    it('getPendingAfter gibt leere Liste wenn keine passenden Ops', () => {
        assert.strictEqual(queue.getPendingAfter(9999).length, 0);
    });


    // ------------------------------------------------------------------
    // clear
    // ------------------------------------------------------------------

    it('clear leert die Queue vollständig', () => {
        queue.enqueue(op(OperationType.PART_PLACED, {}));
        queue.enqueue(op(OperationType.PART_PLACED, {}));
        queue.clear();
        assert.strictEqual(queue.size, 0);
    });


    // ------------------------------------------------------------------
    // maxSize
    // ------------------------------------------------------------------

    it('maxSize begrenzt die Anzahl der Operationen', () => {
        const smallQueue = new OperationQueue({ maxSize: 3 });
        for (let i = 0; i < 5; i++) {
            smallQueue.enqueue(op(OperationType.PART_PLACED, { instanceId: `i${i}` }));
        }
        assert.ok(smallQueue.size <= 3, `Queue-Größe ${smallQueue.size} überschreitet maxSize 3`);
    });


    // ------------------------------------------------------------------
    // subscribe
    // ------------------------------------------------------------------

    it('subscribe wird nach enqueue aufgerufen', () => {
        let callCount = 0;
        queue.subscribe(() => { callCount++; });
        queue.enqueue(op(OperationType.PART_PLACED, {}));
        assert.ok(callCount >= 1, 'subscribe-Callback wurde nicht aufgerufen');
    });

    it('subscribe wird nach dequeue aufgerufen', () => {
        const o = op(OperationType.PART_PLACED, {});
        queue.enqueue(o);
        let callCount = 0;
        queue.subscribe(() => { callCount++; });
        queue.dequeue(o.operationId);
        assert.ok(callCount >= 1, 'subscribe-Callback nach dequeue nicht aufgerufen');
    });

    it('subscribe wird nach clear aufgerufen', () => {
        queue.enqueue(op(OperationType.PART_PLACED, {}));
        let callCount = 0;
        queue.subscribe(() => { callCount++; });
        queue.clear();
        assert.ok(callCount >= 1, 'subscribe-Callback nach clear nicht aufgerufen');
    });

    it('Unsubscribe stoppt Benachrichtigungen', () => {
        let callCount = 0;
        const unsub = queue.subscribe(() => { callCount++; });
        unsub();
        queue.enqueue(op(OperationType.PART_PLACED, {}));
        assert.strictEqual(callCount, 0);
    });

});
