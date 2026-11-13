/**
 * Tests für SyncStatusManager (Phase 9.5)
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SyncStatusManager, SyncStatus } from '../src/cloud/SyncStatusManager.js';


describe('SyncStatusManager', () => {

    let manager;

    beforeEach(() => {
        manager = new SyncStatusManager();
    });


    // ------------------------------------------------------------------
    // Initialisierung
    // ------------------------------------------------------------------

    it('ist initial LOCAL_ONLY', () => {
        assert.strictEqual(manager.status, SyncStatus.LOCAL_ONLY);
    });

    it('isLocalOnly ist initial true', () => {
        assert.strictEqual(manager.isLocalOnly(), true);
    });

    it('isSynced ist initial false', () => {
        assert.strictEqual(manager.isSynced(), false);
    });


    // ------------------------------------------------------------------
    // Statusübergänge
    // ------------------------------------------------------------------

    it('setStatus wechselt zu SYNCED', () => {
        manager.setStatus(SyncStatus.SYNCED);
        assert.strictEqual(manager.status, SyncStatus.SYNCED);
        assert.strictEqual(manager.isSynced(), true);
    });

    it('setStatus wechselt zu MODIFIED', () => {
        manager.setStatus(SyncStatus.MODIFIED);
        assert.strictEqual(manager.isModified(), true);
    });

    it('setStatus wechselt zu SYNCING', () => {
        manager.setStatus(SyncStatus.SYNCING);
        assert.strictEqual(manager.isSyncing(), true);
    });

    it('setStatus wechselt zu ERROR', () => {
        manager.setStatus(SyncStatus.ERROR);
        assert.strictEqual(manager.hasError(), true);
    });

    it('setStatus wechselt zu CONFLICT', () => {
        manager.setStatus(SyncStatus.CONFLICT);
        assert.strictEqual(manager.isConflict(), true);
    });

    it('setStatus wechselt zu OFFLINE', () => {
        manager.setStatus(SyncStatus.OFFLINE);
        assert.strictEqual(manager.isOffline(), true);
    });

    it('setStatus wirft bei ungültigem Status', () => {
        assert.throws(() => manager.setStatus('ungültig'), Error);
    });

    it('details werden mit Status gespeichert', () => {
        manager.setStatus(SyncStatus.ERROR, { reason: 'timeout' });
        assert.strictEqual(manager.details.reason, 'timeout');
    });

    it('details werden nicht durch Referenz weitergegeben', () => {
        const d = { x: 1 };
        manager.setStatus(SyncStatus.ERROR, d);
        d.x = 99;
        assert.strictEqual(manager.details.x, 1);
    });


    // ------------------------------------------------------------------
    // Subscriber
    // ------------------------------------------------------------------

    it('subscribe wird bei Statuswechsel aufgerufen', () => {
        let called = false;
        manager.subscribe(() => { called = true; });
        manager.setStatus(SyncStatus.SYNCED);
        assert.ok(called);
    });

    it('Subscriber erhält neuen Status', () => {
        let received;
        manager.subscribe(s => { received = s; });
        manager.setStatus(SyncStatus.MODIFIED);
        assert.strictEqual(received, SyncStatus.MODIFIED);
    });

    it('Unsubscribe stoppt Benachrichtigungen', () => {
        let count = 0;
        const unsub = manager.subscribe(() => count++);
        unsub();
        manager.setStatus(SyncStatus.SYNCED);
        assert.strictEqual(count, 0);
    });

    it('mehrere Subscriber werden alle benachrichtigt', () => {
        let a = 0, b = 0;
        manager.subscribe(() => a++);
        manager.subscribe(() => b++);
        manager.setStatus(SyncStatus.SYNCED);
        assert.strictEqual(a, 1);
        assert.strictEqual(b, 1);
    });

    it('Fehler in einem Subscriber stoppen nicht andere', () => {
        let b = 0;
        manager.subscribe(() => { throw new Error('oops'); });
        manager.subscribe(() => b++);
        assert.doesNotThrow(() => manager.setStatus(SyncStatus.SYNCED));
        assert.strictEqual(b, 1);
    });

});
