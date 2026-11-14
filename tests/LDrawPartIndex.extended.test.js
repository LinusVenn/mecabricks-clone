/**
 * Erweiterte Tests für LDrawPartIndex (C.1)
 *
 * Abdeckung von Lücken:
 *  - getAll() – Rückgabe einer Kopie (kein Live-Set)
 *  - unregisterPart() – alle Zweige
 *  - clear() – vollständiger Reset
 *  - initialize({ force: true }) – Nachladen
 *  - initialize() Concurrency-Guard
 *  - Schema V1 Objekt-Felder: partNumber und id
 *  - buildFromFileList() mit nicht-Array-Eingabe
 *  - Konstruktor-Validierung (ungültige baseUrl)
 *  - hasPart({ checkFile: false }) wenn kein Manifest
 *  - #checkFile – fetch-Erfolg und fetch-Fehler
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LDrawPartIndex } from '../src/catalog/mapping/LDrawPartIndex.js';


// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeFetch(data, status = 200) {
    return async () => ({
        ok:   status >= 200 && status < 300,
        status,
        json: async () => data,
    });
}

function makeHeadFetch(status = 200) {
    return async (_url, _opts) => ({
        ok: status >= 200 && status < 300,
        status
    });
}


// ─── getAll() ────────────────────────────────────────────────────────────────

describe('LDrawPartIndex – getAll()', () => {

    it('gibt alle indizierten Teilenummern als Array zurück', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(['3001', '3020', '3069'])
        });
        await index.initialize();

        const all = index.getAll();
        assert.ok(Array.isArray(all));
        assert.ok(all.includes('3001'));
        assert.ok(all.includes('3020'));
        assert.ok(all.includes('3069'));
        assert.strictEqual(all.length, 3);
    });

    it('gibt eine Kopie zurück – Änderungen am Array beeinflussen den Index nicht', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(['3001'])
        });
        await index.initialize();

        const all = index.getAll();
        all.push('9999-injected');

        // Index selbst unverändert
        assert.strictEqual(index.getCount(), 1);
        assert.ok(!index.hasIndexedPart('9999-injected'));
    });

    it('leerer Index liefert leeres Array', () => {
        const index = LDrawPartIndex.buildFromFileList([]);
        assert.deepStrictEqual(index.getAll(), []);
    });
});


// ─── unregisterPart() ────────────────────────────────────────────────────────

describe('LDrawPartIndex – unregisterPart()', () => {

    it('entfernt eine vorhandene Teilenummer und gibt true zurück', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat', '3020.dat']);

        const result = index.unregisterPart('3001');

        assert.strictEqual(result, true);
        assert.strictEqual(index.hasIndexedPart('3001'), false);
        assert.strictEqual(index.getCount(), 1);
    });

    it('gibt false zurück für eine nicht-indizierte Teilenummer', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);

        assert.strictEqual(index.unregisterPart('9999'), false);
    });

    it('akzeptiert Teilenummern mit .dat-Endung', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);

        const result = index.unregisterPart('3001.dat');
        assert.strictEqual(result, true);
        assert.strictEqual(index.hasIndexedPart('3001'), false);
    });

    it('gibt false zurück für null-Eingabe', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);
        assert.strictEqual(index.unregisterPart(null), false);
    });

    it('gibt false zurück für leere Zeichenkette', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);
        assert.strictEqual(index.unregisterPart(''), false);
    });

    it('gibt false zurück für ungültige Teilenummer mit Sonderzeichen', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);
        assert.strictEqual(index.unregisterPart('?invalid!'), false);
    });
});


// ─── clear() ────────────────────────────────────────────────────────────────

describe('LDrawPartIndex – clear()', () => {

    it('setzt isLoaded() auf false', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);
        assert.ok(index.isLoaded());

        index.clear();
        assert.strictEqual(index.isLoaded(), false);
    });

    it('setzt isManifestAvailable() auf false', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);
        assert.ok(index.isManifestAvailable());

        index.clear();
        assert.strictEqual(index.isManifestAvailable(), false);
    });

    it('setzt getCount() auf 0', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat', '3020.dat', '3069.dat']);
        assert.strictEqual(index.getCount(), 3);

        index.clear();
        assert.strictEqual(index.getCount(), 0);
    });

    it('macht registerPart nach clear() wieder möglich', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);
        index.clear();

        index.registerPart('9999');
        assert.ok(index.hasIndexedPart('9999'));
    });

    it('doppeltes clear() wirft nicht', () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);
        index.clear();
        assert.doesNotThrow(() => index.clear());
    });
});


// ─── initialize({ force: true }) ─────────────────────────────────────────────

describe('LDrawPartIndex – initialize({ force: true })', () => {

    it('lädt das Manifest neu wenn force: true gesetzt', async () => {
        let callCount = 0;
        const fetches = [
            { parts: ['3001'] },    // erster Aufruf
            { parts: ['3001', '3020'] } // zweiter Aufruf (force reload)
        ];

        const index = new LDrawPartIndex({
            fetchImpl: async () => ({
                ok:   true,
                status: 200,
                json: async () => fetches[callCount++]
            })
        });

        await index.initialize();
        assert.strictEqual(index.getCount(), 1);

        await index.initialize({ force: true });
        assert.strictEqual(index.getCount(), 2);
    });

    it('initialize() ohne force nutzt gecachte Daten (kein zweiter fetch)', async () => {
        let callCount = 0;
        const index = new LDrawPartIndex({
            fetchImpl: async () => {
                callCount++;
                return { ok: true, status: 200, json: async () => ['3001'] };
            }
        });

        await index.initialize();
        await index.initialize(); // zweiter Aufruf ohne force
        await index.initialize(); // dritter Aufruf ohne force

        assert.strictEqual(callCount, 1, 'Fetch darf nur einmal aufgerufen werden');
    });
});


// ─── initialize() Concurrency-Guard ──────────────────────────────────────────

describe('LDrawPartIndex – Concurrency-Guard', () => {

    it('parallele initialize()-Aufrufe liefern dasselbe Promise', async () => {
        let resolveAll;
        let callCount = 0;

        const index = new LDrawPartIndex({
            fetchImpl: async () => {
                callCount++;
                return {
                    ok:   true,
                    status: 200,
                    json: async () => ['3001']
                };
            }
        });

        // Zwei parallele Aufrufe starten
        const p1 = index.initialize();
        const p2 = index.initialize();

        await Promise.all([p1, p2]);

        // Fetch darf trotz zweier paralleler Aufrufe nur einmal ausgeführt werden
        assert.strictEqual(callCount, 1, 'Fetch muss einmalig pro Ladevorgang sein');
        assert.strictEqual(index.getCount(), 1);
    });
});


// ─── Schema V1 – Objekt-Felder partNumber und id ─────────────────────────────

describe('LDrawPartIndex – Schema V1 Objekt-Felder', () => {

    it('liest Teilenummern aus Eintrags-Objekten mit partNumber-Feld', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch({
                parts: [
                    { partNumber: '3001' },
                    { partNumber: '3020.dat' }
                ]
            })
        });
        await index.initialize();

        assert.ok(index.isManifestAvailable());
        assert.ok(await index.hasPart('3001', { checkFile: false }));
        assert.ok(await index.hasPart('3020', { checkFile: false }));
    });

    it('liest Teilenummern aus Eintrags-Objekten mit id-Feld', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch({
                parts: [
                    { id: '3001' },
                    { id: 's/3001s01.dat' }
                ]
            })
        });
        await index.initialize();

        assert.ok(await index.hasPart('3001',    { checkFile: false }));
        assert.ok(await index.hasPart('3001s01', { checkFile: false }));
    });
});


// ─── buildFromFileList() mit ungültiger Eingabe ───────────────────────────────

describe('LDrawPartIndex.buildFromFileList() – Randfälle', () => {

    it('gibt leeren Index zurück wenn files kein Array ist (null)', () => {
        const index = LDrawPartIndex.buildFromFileList(null);
        assert.strictEqual(index.getCount(), 0);
        assert.ok(index.isLoaded());
    });

    it('gibt leeren Index zurück wenn files kein Array ist (Zahl)', () => {
        const index = LDrawPartIndex.buildFromFileList(42);
        assert.strictEqual(index.getCount(), 0);
    });

    it('ignoriert Einträge mit unbekannter Erweiterung (.obj, .fbx)', () => {
        const index = LDrawPartIndex.buildFromFileList([
            'model.obj',
            'part.fbx',
            '3001.dat'  // einziger gültiger Eintrag
        ]);
        assert.strictEqual(index.getCount(), 1);
        assert.ok(index.hasIndexedPart('3001'));
    });
});


// ─── Konstruktor-Validierung (ungültige baseUrl) ──────────────────────────────

describe('LDrawPartIndex – Konstruktor-Validierung', () => {

    it('wirft bei baseUrl als leerem String', () => {
        assert.throws(
            () => new LDrawPartIndex({ baseUrl: '' }),
            /Ungültige LDraw-Basis-URL/
        );
    });

    it('wirft bei baseUrl als Whitespace', () => {
        assert.throws(
            () => new LDrawPartIndex({ baseUrl: '   ' }),
            /Ungültige LDraw-Basis-URL/
        );
    });

    it('hängt automatisch einen Schrägstrich an wenn baseUrl keinen hat', () => {
        const index = new LDrawPartIndex({ baseUrl: '/ldraw' });
        assert.ok(index.baseUrl.endsWith('/'));
    });

    it('lässt baseUrl mit abschließendem Schrägstrich unverändert', () => {
        const index = new LDrawPartIndex({ baseUrl: '/ldraw/' });
        assert.strictEqual(index.baseUrl, '/ldraw/');
    });
});


// ─── hasPart() mit checkFile: false ohne Manifest ─────────────────────────────

describe('LDrawPartIndex – hasPart() ohne Manifest', () => {

    it('gibt null zurück wenn Manifest nicht verfügbar und checkFile: false', async () => {
        const index = new LDrawPartIndex({ fetchImpl: null });
        await index.initialize(); // manifestAvailable = false

        const result = await index.hasPart('3001', { checkFile: false });
        assert.strictEqual(result, null);
    });
});


// ─── #checkFile – Fallback-Verhalten ──────────────────────────────────────────

describe('LDrawPartIndex – #checkFile (HTTP-Fallback)', () => {

    it('gibt true zurück wenn HTTP-HEAD 200 zurückliefert', async () => {
        // Zwei Fetches: erster für Manifest (404), zweiter für Datei-Check (200)
        let call = 0;
        const index = new LDrawPartIndex({
            fetchImpl: async (_url) => {
                call++;
                if (call === 1) {
                    // Manifest nicht erreichbar
                    return { ok: false, status: 404, json: async () => ({}) };
                }
                // Datei-Check erfolgreich
                return { ok: true, status: 200 };
            }
        });
        await index.initialize(); // manifestAvailable = false nach 404

        const result = await index.hasPart('3001'); // kein checkFile:false → triggert #checkFile
        assert.strictEqual(result, true);
    });

    it('gibt null zurück wenn HTTP-Request fehlschlägt', async () => {
        let call = 0;
        const index = new LDrawPartIndex({
            fetchImpl: async () => {
                call++;
                if (call === 1) return { ok: false, status: 404, json: async () => ({}) };
                throw new Error('Netzwerkfehler');
            }
        });
        await index.initialize();

        const result = await index.hasPart('3001');
        assert.strictEqual(result, null);
    });
});
