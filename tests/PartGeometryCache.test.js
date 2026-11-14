import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PartGeometryCache } from '../src/catalog/geometry/PartGeometryCache.js';

describe('PartGeometryCache', () => {

    let cache;

    beforeEach(() => {
        cache = new PartGeometryCache();
    });

    // -----------------------------------------------------------------------
    // Initialisierung
    // -----------------------------------------------------------------------

    it('size() gibt 0 zurück nach der Initialisierung', () => {
        assert.strictEqual(cache.size(), 0);
    });

    // -----------------------------------------------------------------------
    // set() / get() – Speichern und Abrufen
    // -----------------------------------------------------------------------

    it('set() und get() speichern und liefern einen Eintrag zurück', () => {
        const data = { object3D: {}, dimensions: { width: 2, depth: 2, height: 1.2 } };
        cache.set('brick_2x2', data);

        assert.strictEqual(cache.get('brick_2x2'), data);
    });

    // -----------------------------------------------------------------------
    // get() – unbekannter Schlüssel
    // -----------------------------------------------------------------------

    it('get() gibt null zurück wenn kein Eintrag für den Schlüssel vorhanden ist', () => {
        assert.strictEqual(cache.get('nicht_vorhanden'), null);
    });

    // -----------------------------------------------------------------------
    // has() – gibt true nach set()
    // -----------------------------------------------------------------------

    it('has() gibt true zurück nachdem ein Eintrag gesetzt wurde', () => {
        cache.set('brick_2x4', { dimensions: {} });
        assert.strictEqual(cache.has('brick_2x4'), true);
    });

    // -----------------------------------------------------------------------
    // has() – gibt false für unbekannten Schlüssel
    // -----------------------------------------------------------------------

    it('has() gibt false zurück für einen nicht vorhandenen Schlüssel', () => {
        assert.strictEqual(cache.has('unbekannt_xyz'), false);
    });

    // -----------------------------------------------------------------------
    // evict() – entfernt einen Eintrag
    // -----------------------------------------------------------------------

    it('evict() entfernt den Eintrag für den angegebenen Schlüssel', () => {
        cache.set('brick_1x2', { dimensions: {} });
        assert.strictEqual(cache.has('brick_1x2'), true);

        cache.evict('brick_1x2');

        assert.strictEqual(cache.has('brick_1x2'), false);
        assert.strictEqual(cache.get('brick_1x2'), null);
    });

    // -----------------------------------------------------------------------
    // evict() – kein Fehler für unbekannten Schlüssel
    // -----------------------------------------------------------------------

    it('evict() wirft keinen Fehler wenn der Schlüssel nicht existiert', () => {
        assert.doesNotThrow(() => {
            cache.evict('existiert_nicht');
        });
    });

    // -----------------------------------------------------------------------
    // clear() – entfernt alle Einträge
    // -----------------------------------------------------------------------

    it('clear() entfernt alle Einträge und setzt size() auf 0 zurück', () => {
        cache.set('teil_a', { dimensions: {} });
        cache.set('teil_b', { dimensions: {} });
        cache.set('teil_c', { dimensions: {} });

        cache.clear();

        assert.strictEqual(cache.size(), 0);
        assert.strictEqual(cache.get('teil_a'), null);
        assert.strictEqual(cache.get('teil_b'), null);
        assert.strictEqual(cache.get('teil_c'), null);
    });

    // -----------------------------------------------------------------------
    // size() – korrekte Anzahl nach mehreren set()-Aufrufen
    // -----------------------------------------------------------------------

    it('size() gibt die korrekte Anzahl nach mehreren set()-Aufrufen zurück', () => {
        cache.set('p1', {});
        cache.set('p2', {});
        cache.set('p3', {});

        assert.strictEqual(cache.size(), 3);
    });

    // -----------------------------------------------------------------------
    // set() mit numerischer partId – wird zu String konvertiert
    // -----------------------------------------------------------------------

    it('set() mit numerischer partId speichert den Eintrag unter dem String-Schlüssel', () => {
        const data = { dimensions: { width: 1, depth: 1, height: 1.2 } };
        cache.set(1, data);

        // Abruf über den String-Schlüssel muss denselben Eintrag liefern
        assert.strictEqual(cache.get('1'), data);
        // Auch get() mit numerischer ID muss den Eintrag liefern (da intern String)
        assert.strictEqual(cache.get(1), data);
        // has() muss ebenfalls true liefern
        assert.strictEqual(cache.has('1'), true);
    });
});
