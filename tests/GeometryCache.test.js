import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// =====================================================================
// Minimal-THREE-Polyfill für GeometryCache (kein echtes WebGL nötig)
// =====================================================================
let disposeCallCount = 0;

function makeGeo() {
    let disposed = false;
    return {
        isBufferGeometry: true,
        dispose() {
            if (!disposed) { disposed = true; disposeCallCount++; }
        },
        _disposed: () => disposed,
    };
}

import { GeometryCache } from '../src/performance/GeometryCache.js';


describe('GeometryCache', () => {

    let cache;

    beforeEach(() => {
        cache             = new GeometryCache();
        disposeCallCount  = 0;
    });


    // ------------------------------------------------------------------
    // acquire – Factory-Aufruf und Cache-Trefferquote
    // ------------------------------------------------------------------

    it('ruft die Factory beim ersten Zugriff auf', () => {
        let called = 0;
        cache.acquire('key1', () => { called++; return makeGeo(); });
        assert.strictEqual(called, 1);
    });

    it('ruft die Factory bei erneutem Zugriff NICHT auf (Cache-Treffer)', () => {
        let called = 0;
        const factory = () => { called++; return makeGeo(); };
        cache.acquire('key1', factory);
        cache.acquire('key1', factory);
        assert.strictEqual(called, 1);
    });

    it('gibt bei wiederholtem acquire dieselbe Geometrie-Instanz zurück', () => {
        const factory = () => makeGeo();
        const g1 = cache.acquire('key1', factory);
        const g2 = cache.acquire('key1', factory);
        assert.strictEqual(g1, g2);
    });

    it('erstellt für verschiedene Keys verschiedene Geometrien', () => {
        const g1 = cache.acquire('key1', makeGeo);
        const g2 = cache.acquire('key2', makeGeo);
        assert.notStrictEqual(g1, g2);
    });


    // ------------------------------------------------------------------
    // Referenzzählung
    // ------------------------------------------------------------------

    it('refCount steigt mit jedem acquire', () => {
        cache.acquire('key1', makeGeo);
        cache.acquire('key1', makeGeo);
        assert.strictEqual(cache.getRefCount('key1'), 2);
    });

    it('refCount fällt nach release', () => {
        cache.acquire('key1', makeGeo);
        cache.acquire('key1', makeGeo);
        cache.release('key1');
        assert.strictEqual(cache.getRefCount('key1'), 1);
    });

    it('Geometrie wird disposed wenn refCount auf 0 fällt', () => {
        const geo = cache.acquire('key1', () => makeGeo());
        cache.release('key1');
        assert.ok(geo._disposed(), 'dispose() sollte aufgerufen worden sein');
    });

    it('Geometrie bleibt solange erhalten wie refCount > 0', () => {
        const geo = cache.acquire('key1', () => makeGeo());
        cache.acquire('key1', makeGeo);          // refCount = 2
        cache.release('key1');                    // refCount = 1
        assert.ok(!geo._disposed());
        cache.release('key1');                    // refCount = 0 → dispose
        assert.ok(geo._disposed());
    });

    it('release ohne vorheriges acquire wirft keinen Fehler', () => {
        assert.doesNotThrow(() => cache.release('nieExistiert'));
    });


    // ------------------------------------------------------------------
    // has / size
    // ------------------------------------------------------------------

    it('has gibt false zurück für unbekannten Key', () => {
        assert.strictEqual(cache.has('unknown'), false);
    });

    it('has gibt true zurück nach acquire', () => {
        cache.acquire('key1', makeGeo);
        assert.strictEqual(cache.has('key1'), true);
    });

    it('has gibt false zurück nachdem alle Referenzen freigegeben wurden', () => {
        cache.acquire('key1', makeGeo);
        cache.release('key1');
        assert.strictEqual(cache.has('key1'), false);
    });

    it('size liefert die Anzahl der gecachten Geometrien', () => {
        cache.acquire('a', makeGeo);
        cache.acquire('b', makeGeo);
        assert.strictEqual(cache.size, 2);
    });


    // ------------------------------------------------------------------
    // dispose
    // ------------------------------------------------------------------

    it('dispose gibt alle Geometrien frei', () => {
        cache.acquire('a', makeGeo);
        cache.acquire('b', makeGeo);
        cache.dispose();
        assert.strictEqual(disposeCallCount, 2);
        assert.strictEqual(cache.size, 0);
    });

    it('nach dispose ist has() für alle Keys false', () => {
        cache.acquire('a', makeGeo);
        cache.dispose();
        assert.strictEqual(cache.has('a'), false);
    });

});
