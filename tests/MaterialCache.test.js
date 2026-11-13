import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// =====================================================================
// THREE-Polyfill: nur MeshStandardMaterial benötigt
// =====================================================================
let disposeCount = 0;

class MockMeshStandardMaterial {
    constructor({ color = 0xffffff } = {}) {
        this.color   = { getHex: () => color, setHex: (c) => { color = c; } };
        this._color  = color;
        this.disposed = false;
    }
    dispose() {
        if (!this.disposed) { this.disposed = true; disposeCount++; }
    }
}

// Überschreibe den THREE-Import, bevor MaterialCache importiert wird
// – geschieht durch das Mock-Modul-Muster, das der Test-Runner unterstützt.
// Da node:test keinen Modul-Mock kennt, patchen wir den Konstruktor über
// einen globalen Stub und passen MaterialCache daran an.
//
// Einfacherer Weg: MaterialCache akzeptiert optionalen materialFactory-
// Parameter. Für Tests übergeben wir eine Factory, die MockMaterial liefert.

import { MaterialCache } from '../src/performance/MaterialCache.js';


describe('MaterialCache', () => {

    let cache;

    beforeEach(() => {
        disposeCount = 0;
        // Übergabe einer Test-Factory, die kein WebGL benötigt
        cache = new MaterialCache(
            color => new MockMeshStandardMaterial({ color })
        );
    });


    // ------------------------------------------------------------------
    // acquire – Cache-Trefferquote
    // ------------------------------------------------------------------

    it('erstellt ein neues Material beim ersten acquire', () => {
        const mat = cache.acquire(0xff0000);
        assert.ok(mat);
    });

    it('gibt bei wiederholtem acquire dieselbe Instanz zurück', () => {
        const m1 = cache.acquire(0xff0000);
        const m2 = cache.acquire(0xff0000);
        assert.strictEqual(m1, m2);
    });

    it('erstellt für verschiedene Farben verschiedene Materialien', () => {
        const m1 = cache.acquire(0xff0000);
        const m2 = cache.acquire(0x00ff00);
        assert.notStrictEqual(m1, m2);
    });


    // ------------------------------------------------------------------
    // Referenzzählung
    // ------------------------------------------------------------------

    it('refCount steigt mit jedem acquire', () => {
        cache.acquire(0xffffff);
        cache.acquire(0xffffff);
        assert.strictEqual(cache.getRefCount(0xffffff), 2);
    });

    it('Material wird disposed wenn refCount auf 0 fällt', () => {
        const mat = cache.acquire(0xaabbcc);
        cache.release(0xaabbcc);
        assert.ok(mat.disposed);
    });

    it('Material bleibt erhalten wenn refCount > 0', () => {
        const mat = cache.acquire(0xaabbcc);
        cache.acquire(0xaabbcc);  // refCount = 2
        cache.release(0xaabbcc);  // refCount = 1
        assert.ok(!mat.disposed);
        cache.release(0xaabbcc);  // refCount = 0 → dispose
        assert.ok(mat.disposed);
    });

    it('release ohne vorheriges acquire wirft keinen Fehler', () => {
        assert.doesNotThrow(() => cache.release(0xdeadbe));
    });


    // ------------------------------------------------------------------
    // Isolation: Farbe eines Materials darf andere nicht beeinflussen
    // ------------------------------------------------------------------

    it('Zwei Materialien teilen KEINE Materialinstanz für verschiedene Farben', () => {
        const red   = cache.acquire(0xff0000);
        const green = cache.acquire(0x00ff00);
        // Verschiedene Instanzen – Änderung an einer darf andere nicht treffen
        assert.notStrictEqual(red, green);
    });


    // ------------------------------------------------------------------
    // has / size
    // ------------------------------------------------------------------

    it('has gibt false zurück für unbekannte Farbe', () => {
        assert.strictEqual(cache.has(0x112233), false);
    });

    it('has gibt true zurück nach acquire', () => {
        cache.acquire(0x112233);
        assert.strictEqual(cache.has(0x112233), true);
    });

    it('has gibt false zurück nach vollständigem release', () => {
        cache.acquire(0x112233);
        cache.release(0x112233);
        assert.strictEqual(cache.has(0x112233), false);
    });

    it('size liefert korrekte Anzahl gecachter Materialien', () => {
        cache.acquire(0xaaaaaa);
        cache.acquire(0xbbbbbb);
        assert.strictEqual(cache.size, 2);
    });


    // ------------------------------------------------------------------
    // dispose
    // ------------------------------------------------------------------

    it('dispose gibt alle Materialien frei', () => {
        cache.acquire(0xaaaaaa);
        cache.acquire(0xbbbbbb);
        cache.dispose();
        assert.strictEqual(disposeCount, 2);
        assert.strictEqual(cache.size, 0);
    });

    it('nach dispose ist has() für alle Farben false', () => {
        cache.acquire(0xaaaaaa);
        cache.dispose();
        assert.strictEqual(cache.has(0xaaaaaa), false);
    });

});
