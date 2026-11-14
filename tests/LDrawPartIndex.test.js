/**
 * Tests für LDrawPartIndex (C.1)
 *
 * Prüft:
 *  - Automatisches Laden aus Manifest (Schema V1 + V2)
 *  - Groß-/Kleinschreibung (Case-insensitive)
 *  - Duplikaterkennung aus Manifest
 *  - Unterstützung von .ldr-Dateien
 *  - Subdirectory-Pfade (.split('/').pop())
 *  - buildFromFileList static factory
 *  - Fallback-Verhalten ohne Manifest
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LDrawPartIndex } from '../src/catalog/mapping/LDrawPartIndex.js';


// ─── Hilfsfunktion: fetch-Mock ───────────────────────────────────────────────

function makeFetch(data, status = 200) {
    return async () => ({
        ok:     status >= 200 && status < 300,
        status,
        json:   async () => data,
    });
}


// ─── Schema V1 – Plain Array ─────────────────────────────────────────────────

describe('LDrawPartIndex – Manifest Schema V1 (Array)', () => {

    it('lädt Teilenummern aus einem reinen Array', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(['3001', '3020', '3069'])
        });
        await index.initialize();

        assert.ok(index.isLoaded());
        assert.ok(index.isManifestAvailable());
        assert.strictEqual(index.getCount(), 3);
        assert.ok(await index.hasPart('3001', { checkFile: false }));
        assert.ok(await index.hasPart('3020', { checkFile: false }));
    });

    it('lädt aus { parts: [...] }', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch({ parts: ['3001.dat', '3020.dat'] })
        });
        await index.initialize();

        assert.ok(await index.hasPart('3001', { checkFile: false }));
    });

    it('akzeptiert Eintrags-Objekte mit file-Feld', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch({
                parts: [
                    { file: '3001.dat' },
                    { file: 'parts/s/2421a.dat' }
                ]
            })
        });
        await index.initialize();

        assert.ok(await index.hasPart('3001', { checkFile: false }));
        // Subdirectory: nur der Dateiname zählt
        assert.ok(await index.hasPart('2421a', { checkFile: false }));
    });
});


// ─── Schema V2 – Mit Duplikaten und Metadaten ────────────────────────────────

describe('LDrawPartIndex – Manifest Schema V2', () => {

    const v2Manifest = {
        schemaVersion: 2,
        generatedAt:   '2026-01-01T00:00:00.000Z',
        partsDir:      'parts/',
        count:         4,
        duplicates: [
            { partNumber: '2421a', files: ['2421a.dat', 's/2421a.dat'] }
        ],
        parts: [
            { file: '3001.dat',      partNumber: '3001'  },
            { file: '3020.dat',      partNumber: '3020'  },
            { file: '2421a.dat',     partNumber: '2421a' },
            { file: 's/2421a.dat',   partNumber: '2421a' }
        ]
    };

    it('lädt Teile aus Schema V2', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(v2Manifest)
        });
        await index.initialize();

        assert.ok(await index.hasPart('3001', { checkFile: false }));
        assert.ok(await index.hasPart('3020', { checkFile: false }));
    });

    it('gibt Duplikate über getDuplicates() zurück', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(v2Manifest)
        });
        await index.initialize();

        const dups = index.getDuplicates();
        assert.strictEqual(dups.length, 1);
        assert.strictEqual(dups[0].partNumber, '2421a');
    });

    it('hasDuplicates() erkennt bekannte Duplikate', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(v2Manifest)
        });
        await index.initialize();

        assert.ok(index.hasDuplicates('2421a'));
        assert.ok(!index.hasDuplicates('3001'));
    });

    it('getDuplicates() gibt leeres Array zurück wenn kein Duplikat bekannt', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(['3001', '3020'])
        });
        await index.initialize();

        assert.deepStrictEqual(index.getDuplicates(), []);
    });
});


// ─── Groß-/Kleinschreibung ────────────────────────────────────────────────────

describe('LDrawPartIndex – Case-insensitive Normalisierung', () => {

    it('Großbuchstaben in Abfragen werden normalisiert', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(['3001', '3020'])
        });
        await index.initialize();

        assert.ok(await index.hasPart('3001',     { checkFile: false }));
        assert.ok(await index.hasPart('3001.dat', { checkFile: false }));
    });

    it('Manifest mit Großbuchstaben wird normalisiert gespeichert', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(['3001.DAT', '3020.Dat', 'BRICK.dat'])
        });
        await index.initialize();

        assert.ok(await index.hasPart('3001',  { checkFile: false }));
        assert.ok(await index.hasPart('3020',  { checkFile: false }));
        assert.ok(await index.hasPart('brick', { checkFile: false }));
    });
});


// ─── .ldr-Unterstützung ───────────────────────────────────────────────────────

describe('LDrawPartIndex – .ldr-Dateiunterstützung', () => {

    it('akzeptiert .ldr-Einträge im Manifest', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch(['car_model.ldr', 'house.ldr', '3001.dat'])
        });
        await index.initialize();

        assert.ok(await index.hasPart('car_model', { checkFile: false }));
        assert.ok(await index.hasPart('house',     { checkFile: false }));
        assert.ok(await index.hasPart('3001',      { checkFile: false }));
    });
});


// ─── Subdirectory-Pfade ───────────────────────────────────────────────────────

describe('LDrawPartIndex – Subdirectory-Pfade', () => {

    it('Subdirectory-Einträge werden auf Dateinamen reduziert', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch([
                's/3001s01.dat',
                's/3001s02',
                'parts/3001.dat'
            ])
        });
        await index.initialize();

        // Nur der basename
        assert.ok(await index.hasPart('3001s01', { checkFile: false }));
        assert.ok(await index.hasPart('3001s02', { checkFile: false }));
        assert.ok(await index.hasPart('3001',    { checkFile: false }));
    });

    it('hasIndexedPart() gibt null zurück wenn Manifest nicht geladen', () => {
        const index = new LDrawPartIndex({ fetchImpl: null });
        assert.strictEqual(index.hasIndexedPart('3001'), null);
    });
});


// ─── buildFromFileList (statisch) ────────────────────────────────────────────

describe('LDrawPartIndex.buildFromFileList()', () => {

    it('erstellt Index aus einer Dateiliste ohne fetch', () => {
        const index = LDrawPartIndex.buildFromFileList([
            '3001.dat',
            '3020.dat',
            's/3001s01.dat',
            'model.ldr'
        ]);

        assert.ok(index.isLoaded());
        assert.ok(index.isManifestAvailable());
        assert.ok(index.hasIndexedPart('3001'));
        assert.ok(index.hasIndexedPart('3020'));
        assert.ok(index.hasIndexedPart('3001s01'));
        assert.ok(index.hasIndexedPart('model'));
    });

    it('erkennt Duplikate in der Dateiliste', () => {
        const index = LDrawPartIndex.buildFromFileList([
            '3001.dat',
            's/3001.dat',   // Duplikat: gleicher Basename
            '3020.dat'
        ]);

        const dups = index.getDuplicates();
        assert.strictEqual(dups.length, 1);
        assert.strictEqual(dups[0].partNumber, '3001');
    });

    it('leere Liste ergibt leeren Index', () => {
        const index = LDrawPartIndex.buildFromFileList([]);
        assert.strictEqual(index.getCount(), 0);
    });

    it('ungültige Dateinamen werden übersprungen', () => {
        const index = LDrawPartIndex.buildFromFileList([
            '3001.dat',
            '?.?.dat',        // ungültig
            '',               // leer
            '   ',            // nur Leerzeichen
        ]);

        assert.strictEqual(index.getCount(), 1);
        assert.ok(index.hasIndexedPart('3001'));
    });
});


// ─── Fallback ohne Manifest ───────────────────────────────────────────────────

describe('LDrawPartIndex – Fehlerbehandlung', () => {

    it('bleibt verwendbar wenn Manifest nicht erreichbar (HTTP 404)', async () => {
        const index = new LDrawPartIndex({
            fetchImpl: makeFetch({}, 404)
        });

        await index.initialize();

        assert.ok(index.isLoaded());
        assert.ok(!index.isManifestAvailable());
        assert.strictEqual(index.getCount(), 0);
    });

    it('bleibt verwendbar wenn fetchImpl fehlt', async () => {
        const index = new LDrawPartIndex({ fetchImpl: null });
        await index.initialize();

        assert.ok(index.isLoaded());
        assert.ok(!index.isManifestAvailable());
    });

    it('registerPart fügt manuell eine Teilenummer ein', () => {
        const index = new LDrawPartIndex({ fetchImpl: null });
        index.registerPart('3001');

        assert.ok(index.hasIndexedPart('3001'));
        assert.ok(index.isManifestAvailable());
    });
});
