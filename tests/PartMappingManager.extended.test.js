/**
 * Erweiterte Tests für PartMappingManager (C.2)
 *
 * Abdeckung von Lücken:
 *  - updateMapping()              – Happy Path, ID-Schutz, Fehlerbehandlung
 *  - removeMapping()              – alle Zweige
 *  - getMappingForInternalPart()  – alle Zweige
 *  - getMappingsForLDrawPart()    – mehrere Treffer, leer, .dat-Normalisierung
 *  - resolveByBrickLinkId()       – alle 4 Status-Ausgaben
 *  - resolveByInternalPartId()    – gefunden / nicht gefunden
 *  - validateAll()                – leer, gemischte Status
 *  - getStatistics()              – Zählung nach Status
 *  - exportJSON() / exportJSONString() – Struktur und Round-Trip
 *  - subscribe() / #notify()      – Events, Unsubscribe, Fehlerresistenz
 *  - initialize()                 – Idempotenz, initialized-Flag
 *  - loadInitialData()            – Fehlerbehandlung
 *  - importCSV() overwrite:true
 *  - importJSON() als JSON-String
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PartMappingManager } from '../src/catalog/mapping/PartMappingManager.js';
import { LDrawPartIndex }     from '../src/catalog/mapping/LDrawPartIndex.js';


// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeManager(mappings = []) {
    return new PartMappingManager({
        initialData: { schemaVersion: 1, mappings }
    });
}

function makeManagerWithIndex(partNumbers = []) {
    const ldrawIndex = LDrawPartIndex.buildFromFileList(
        partNumbers.map(p => `${p}.dat`)
    );
    return new PartMappingManager({
        initialData: { schemaVersion: 1, mappings: [] },
        ldrawIndex
    });
}

const VALID_MAPPING = {
    brickLinkId:     'BL-3001',
    ldrawPartNumber: '3001',
    internalPartId:  'brick_2x4',
    verified:        true,
    source:          'manual'
};


// ═══════════════════════════════════════════════════════════════════════════════
// updateMapping()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – updateMapping()', () => {

    it('aktualisiert felder einer vorhandenen Zuordnung', () => {
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            verified:        false
        }]);

        const updated = mgr.updateMapping('BL-3001', {
            verified:       true,
            internalPartId: 'brick_2x4'
        });

        assert.strictEqual(updated.verified,        true);
        assert.strictEqual(updated.internalPartId, 'brick_2x4');
        assert.strictEqual(updated.brickLinkId,    'BL-3001');  // unveränderlich
    });

    it('schützt die brickLinkId – Änderungsversuch wird überschrieben', () => {
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001'
        }]);

        const updated = mgr.updateMapping('BL-3001', {
            brickLinkId: 'BL-CHANGED'  // Versuch die ID zu ändern
        });

        // Die ID muss unveränderlich bleiben
        assert.strictEqual(updated.brickLinkId, 'BL-3001');
        assert.ok(mgr.getMapping('BL-3001'));
        assert.strictEqual(mgr.getMapping('BL-CHANGED'), null);
    });

    it('wirft bei nicht-existenter BrickLink-ID', () => {
        const mgr = makeManager();

        assert.throws(
            () => mgr.updateMapping('NICHT-VORHANDEN', { verified: true }),
            /wurde nicht gefunden/
        );
    });

    it('wirft wenn nach Update eine ungültige LDraw-Nummer resultiert', () => {
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001'
        }]);

        assert.throws(
            () => mgr.updateMapping('BL-3001', { ldrawPartNumber: 'ungültig!#' }),
            Error
        );
    });

    it('gibt eine Kopie des aktualisierten Mappings zurück', () => {
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001'
        }]);

        const result = mgr.updateMapping('BL-3001', { verified: true });
        result.brickLinkId = 'MUTATED';

        // Intern unveränderlich
        assert.strictEqual(mgr.getMapping('BL-3001')?.brickLinkId, 'BL-3001');
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// removeMapping()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – removeMapping()', () => {

    it('entfernt eine vorhandene Zuordnung und gibt true zurück', () => {
        const mgr = makeManager([{ brickLinkId: 'BL-3001', ldrawPartNumber: '3001' }]);

        const result = mgr.removeMapping('BL-3001');

        assert.strictEqual(result, true);
        assert.strictEqual(mgr.getMapping('BL-3001'), null);
    });

    it('gibt false zurück für nicht-vorhandene ID', () => {
        const mgr = makeManager();

        assert.strictEqual(mgr.removeMapping('NICHT-VORHANDEN'), false);
    });

    it('gibt false zurück für null', () => {
        const mgr = makeManager();
        assert.strictEqual(mgr.removeMapping(null), false);
    });

    it('gibt false zurück für leeren String', () => {
        const mgr = makeManager();
        assert.strictEqual(mgr.removeMapping(''), false);
    });

    it('verringert die Gesamtzahl der Mappings', () => {
        const mgr = makeManager([
            { brickLinkId: 'A', ldrawPartNumber: '3001' },
            { brickLinkId: 'B', ldrawPartNumber: '3020' }
        ]);

        mgr.removeMapping('A');

        assert.strictEqual(mgr.getAllMappings().length, 1);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// getMappingForInternalPart()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – getMappingForInternalPart()', () => {

    it('findet eine Zuordnung anhand der internalPartId', () => {
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            internalPartId:  'brick_2x4'
        }]);

        const result = mgr.getMappingForInternalPart('brick_2x4');

        assert.ok(result);
        assert.strictEqual(result.brickLinkId, 'BL-3001');
    });

    it('gibt null zurück wenn internalPartId nicht gefunden', () => {
        const mgr = makeManager();

        assert.strictEqual(mgr.getMappingForInternalPart('nicht-vorhanden'), null);
    });

    it('gibt null zurück für leeren String', () => {
        const mgr = makeManager([{ brickLinkId: 'X', ldrawPartNumber: '3001', internalPartId: '' }]);
        assert.strictEqual(mgr.getMappingForInternalPart(''), null);
    });

    it('gibt null zurück für nicht-String Eingabe', () => {
        const mgr = makeManager();
        assert.strictEqual(mgr.getMappingForInternalPart(null), null);
        assert.strictEqual(mgr.getMappingForInternalPart(123), null);
        assert.strictEqual(mgr.getMappingForInternalPart(undefined), null);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// getMappingsForLDrawPart()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – getMappingsForLDrawPart()', () => {

    it('findet alle Zuordnungen für eine LDraw-Teilenummer', () => {
        const mgr = makeManager([
            { brickLinkId: 'A', ldrawPartNumber: '3001' },
            { brickLinkId: 'B', ldrawPartNumber: '3001' },  // zweite BL-ID für gleiche LDraw-Nummer
            { brickLinkId: 'C', ldrawPartNumber: '3020' }
        ]);

        const results = mgr.getMappingsForLDrawPart('3001');

        assert.strictEqual(results.length, 2);
        assert.ok(results.some(m => m.brickLinkId === 'A'));
        assert.ok(results.some(m => m.brickLinkId === 'B'));
    });

    it('gibt leeres Array zurück wenn keine Zuordnung gefunden', () => {
        const mgr = makeManager();

        assert.deepStrictEqual(mgr.getMappingsForLDrawPart('9999'), []);
    });

    it('normalisiert .dat-Erweiterung in der Anfrage', () => {
        const mgr = makeManager([{ brickLinkId: 'X', ldrawPartNumber: '3001' }]);

        const results = mgr.getMappingsForLDrawPart('3001.dat');
        assert.strictEqual(results.length, 1);
    });

    it('gibt leeres Array zurück für ungültige Eingabe', () => {
        const mgr = makeManager();
        assert.deepStrictEqual(mgr.getMappingsForLDrawPart(null), []);
        assert.deepStrictEqual(mgr.getMappingsForLDrawPart(''), []);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// resolveByBrickLinkId()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – resolveByBrickLinkId()', () => {

    it('gibt { found: false } wenn keine Zuordnung vorhanden', async () => {
        const mgr = makeManagerWithIndex(['3001']);

        const result = await mgr.resolveByBrickLinkId('NICHT-VORHANDEN');

        assert.strictEqual(result.found,  false);
        assert.strictEqual(result.status, 'missing');
        assert.strictEqual(result.mapping, null);
    });

    it('gibt { found: true, status: "available" } bei verifizierter Zuordnung + Teil im Index', async () => {
        const mgr = makeManagerWithIndex(['3001']);
        mgr.addMapping({ brickLinkId: 'BL-3001', ldrawPartNumber: '3001', verified: true });

        const result = await mgr.resolveByBrickLinkId('BL-3001');

        assert.strictEqual(result.found,  true);
        assert.strictEqual(result.status, 'available');
        assert.ok(result.mapping);
    });

    it('gibt { found: true, status: "unverified" } wenn Teil im Index aber nicht verifiziert', async () => {
        const mgr = makeManagerWithIndex(['3001']);
        mgr.addMapping({ brickLinkId: 'BL-3001', ldrawPartNumber: '3001', verified: false });

        const result = await mgr.resolveByBrickLinkId('BL-3001');

        assert.strictEqual(result.found,  true);
        assert.strictEqual(result.status, 'unverified');
    });

    it('gibt { found: true, status: "missing" } wenn Teil nicht im Index', async () => {
        const mgr = makeManagerWithIndex(['3020']); // 3001 nicht im Index
        mgr.addMapping({ brickLinkId: 'BL-3001', ldrawPartNumber: '3001', verified: true });

        const result = await mgr.resolveByBrickLinkId('BL-3001');

        assert.strictEqual(result.found,  true);
        assert.strictEqual(result.status, 'missing');
    });

    it('gibt { found: true, status: "unverified" } wenn Index ungeladen', async () => {
        // Standard-Manager ohne benutzerdefinierten LDraw-Index → fetchImpl fehlt
        const mgr = makeManager();
        mgr.addMapping({ brickLinkId: 'BL-3001', ldrawPartNumber: '3001', verified: true });

        const result = await mgr.resolveByBrickLinkId('BL-3001');

        // Ungeladen oder kein Manifest → UNVERIFIED
        assert.strictEqual(result.found, true);
        assert.ok(['unverified', 'missing'].includes(result.status),
            `Erwartet unverified oder missing, erhalten: ${result.status}`);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// resolveByInternalPartId()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – resolveByInternalPartId()', () => {

    it('gibt { found: false } wenn keine Zuordnung für internalPartId', async () => {
        const mgr = makeManagerWithIndex(['3001']);

        const result = await mgr.resolveByInternalPartId('nicht-vorhanden');

        assert.strictEqual(result.found,  false);
        assert.strictEqual(result.status, 'missing');
    });

    it('gibt { found: true } wenn Zuordnung über internalPartId gefunden', async () => {
        const mgr = makeManagerWithIndex(['3001']);
        mgr.addMapping({
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            internalPartId:  'brick_2x4',
            verified:        true
        });

        const result = await mgr.resolveByInternalPartId('brick_2x4');

        assert.strictEqual(result.found, true);
        assert.strictEqual(result.status, 'available');
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// validateAll()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – validateAll()', () => {

    it('gibt leeres Array zurück wenn keine Mappings vorhanden', async () => {
        const mgr = makeManager();
        const results = await mgr.validateAll();
        assert.deepStrictEqual(results, []);
    });

    it('jedes Ergebnis enthält status und validationReason', async () => {
        const mgr = makeManagerWithIndex(['3001', '3020']);
        mgr.addMapping({ brickLinkId: 'A', ldrawPartNumber: '3001', verified: true });
        mgr.addMapping({ brickLinkId: 'B', ldrawPartNumber: '3020', verified: false });

        const results = await mgr.validateAll();

        assert.strictEqual(results.length, 2);
        for (const r of results) {
            assert.ok(typeof r.status === 'string', `status fehlt: ${JSON.stringify(r)}`);
            assert.ok('validationReason' in r, `validationReason fehlt: ${JSON.stringify(r)}`);
        }
    });

    it('AVAILABLE-Status für verifizierte Zuordnung mit bekanntem LDraw-Teil', async () => {
        const mgr = makeManagerWithIndex(['3001']);
        mgr.addMapping({ brickLinkId: 'BL-3001', ldrawPartNumber: '3001', verified: true });

        const results = await mgr.validateAll();
        const result  = results.find(r => r.brickLinkId === 'BL-3001');

        assert.strictEqual(result?.status, 'available');
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// getStatistics()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – getStatistics()', () => {

    it('enthält alle erwarteten Schlüssel', async () => {
        const mgr = makeManager();
        const stats = await mgr.getStatistics();

        assert.ok('total'      in stats);
        assert.ok('available'  in stats);
        assert.ok('missing'    in stats);
        assert.ok('unverified' in stats);
        assert.ok('invalid'    in stats);
    });

    it('gibt 0 für alle Zähler bei leerem Manager zurück', async () => {
        const mgr = makeManager();
        const stats = await mgr.getStatistics();

        assert.strictEqual(stats.total,      0);
        assert.strictEqual(stats.available,  0);
        assert.strictEqual(stats.missing,    0);
        assert.strictEqual(stats.unverified, 0);
    });

    it('zählt available und unverified korrekt', async () => {
        const mgr = makeManagerWithIndex(['3001', '3020']);
        mgr.addMapping({ brickLinkId: 'A', ldrawPartNumber: '3001', verified: true  });
        mgr.addMapping({ brickLinkId: 'B', ldrawPartNumber: '3020', verified: false });

        const stats = await mgr.getStatistics();

        assert.strictEqual(stats.total,      2);
        assert.strictEqual(stats.available,  1);
        assert.strictEqual(stats.unverified, 1);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// exportJSON() / exportJSONString()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – exportJSON() / exportJSONString()', () => {

    it('exportJSON() gibt { schemaVersion: 1, mappings: [...] } zurück', () => {
        const mgr = makeManager([{ brickLinkId: 'BL-3001', ldrawPartNumber: '3001' }]);

        const exported = mgr.exportJSON();

        assert.strictEqual(exported.schemaVersion, 1);
        assert.ok(Array.isArray(exported.mappings));
        assert.strictEqual(exported.mappings.length, 1);
    });

    it('exportJSON() enthält alle Mapping-Felder', () => {
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            internalPartId:  'brick_2x4',
            verified:        true
        }]);

        const exported = mgr.exportJSON();
        const mapping  = exported.mappings[0];

        assert.strictEqual(mapping.brickLinkId,     'BL-3001');
        assert.strictEqual(mapping.ldrawPartNumber, '3001');
        assert.strictEqual(mapping.internalPartId,  'brick_2x4');
        assert.strictEqual(mapping.verified,         true);
    });

    it('exportJSONString() gibt gültigen JSON-String zurück', () => {
        const mgr = makeManager([{ brickLinkId: 'BL-3001', ldrawPartNumber: '3001' }]);

        const jsonString = mgr.exportJSONString();

        assert.strictEqual(typeof jsonString, 'string');
        assert.doesNotThrow(() => JSON.parse(jsonString));
    });

    it('exportJSONString() – Round-Trip: loadInitialData von exportJSON', () => {
        const mgr = makeManager([
            { brickLinkId: 'A', ldrawPartNumber: '3001' },
            { brickLinkId: 'B', ldrawPartNumber: '3020' }
        ]);

        const exported = mgr.exportJSON();
        const mgr2     = makeManager();
        mgr2.loadInitialData(exported);

        assert.ok(mgr2.getMapping('A'));
        assert.ok(mgr2.getMapping('B'));
        assert.strictEqual(mgr2.getAllMappings().length, 2);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// subscribe() / #notify()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – subscribe()', () => {

    it('wirft TypeError wenn callback keine Funktion ist', () => {
        const mgr = makeManager();
        assert.throws(
            () => mgr.subscribe('nicht-eine-funktion'),
            TypeError
        );
    });

    it('gibt eine unsubscribe-Funktion zurück', () => {
        const mgr = makeManager();
        const unsub = mgr.subscribe(() => {});
        assert.strictEqual(typeof unsub, 'function');
    });

    it('listener empfängt "mapping-added" Event bei addMapping()', () => {
        const mgr    = makeManager();
        const events = [];
        mgr.subscribe(e => events.push(e));

        mgr.addMapping({ brickLinkId: 'BL-NEW', ldrawPartNumber: '9999' });

        assert.ok(events.some(e => e.type === 'mapping-added'));
    });

    it('listener empfängt "mapping-removed" Event bei removeMapping()', () => {
        const mgr = makeManager([{ brickLinkId: 'X', ldrawPartNumber: '3001' }]);
        const events = [];
        mgr.subscribe(e => events.push(e));

        mgr.removeMapping('X');

        assert.ok(events.some(e => e.type === 'mapping-removed'));
    });

    it('listener empfängt "mapping-updated" Event bei updateMapping()', () => {
        const mgr = makeManager([{ brickLinkId: 'X', ldrawPartNumber: '3001' }]);
        const events = [];
        mgr.subscribe(e => events.push(e));

        mgr.updateMapping('X', { verified: true });

        assert.ok(events.some(e => e.type === 'mapping-updated'));
    });

    it('unsubscribe() stoppt weitere Events', () => {
        const mgr    = makeManager();
        const events = [];
        const unsub  = mgr.subscribe(e => events.push(e));

        unsub();
        mgr.addMapping({ brickLinkId: 'BL-NEW', ldrawPartNumber: '9999' });

        // Kein "mapping-added" nach Unsubscribe
        assert.strictEqual(events.filter(e => e.type === 'mapping-added').length, 0);
    });

    it('Exception im Listener bricht den Manager nicht ab', () => {
        const mgr = makeManager();
        mgr.subscribe(() => { throw new Error('Listener-Fehler'); });

        // addMapping darf trotz Exception im Listener nicht werfen
        assert.doesNotThrow(() => {
            mgr.addMapping({ brickLinkId: 'BL-SAFE', ldrawPartNumber: '9999' });
        });

        assert.ok(mgr.getMapping('BL-SAFE'));
    });

    it('mehrere Listener erhalten dieselben Events', () => {
        const mgr = makeManager();
        let count1 = 0, count2 = 0;
        mgr.subscribe(e => { if (e.type === 'mapping-added') count1++; });
        mgr.subscribe(e => { if (e.type === 'mapping-added') count2++; });

        mgr.addMapping({ brickLinkId: 'BL-A', ldrawPartNumber: '3001' });
        mgr.addMapping({ brickLinkId: 'BL-B', ldrawPartNumber: '3020' });

        assert.strictEqual(count1, 2);
        assert.strictEqual(count2, 2);
    });

    it('Event-Objekt enthält type, payload und manager-Referenz', () => {
        const mgr = makeManager();
        let received = null;
        mgr.subscribe(e => { received = e; });

        mgr.addMapping({ brickLinkId: 'BL-X', ldrawPartNumber: '3001' });

        assert.ok(received);
        assert.strictEqual(typeof received.type, 'string');
        assert.strictEqual(received.manager, mgr);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// initialize()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – initialize()', () => {

    it('setzt initialized = true nach dem ersten Aufruf', async () => {
        const index = new LDrawPartIndex({ fetchImpl: null });
        const mgr   = new PartMappingManager({
            initialData: { schemaVersion: 1, mappings: [] },
            ldrawIndex:  index
        });

        assert.strictEqual(mgr.initialized, false);
        await mgr.initialize();
        assert.strictEqual(mgr.initialized, true);
    });

    it('zweiter Aufruf ist idempotent (gibt sofort this zurück)', async () => {
        const index = new LDrawPartIndex({ fetchImpl: null });
        const mgr   = new PartMappingManager({
            initialData: { schemaVersion: 1, mappings: [] },
            ldrawIndex:  index
        });

        const result1 = await mgr.initialize();
        const result2 = await mgr.initialize();

        assert.strictEqual(result1, mgr);
        assert.strictEqual(result2, mgr);
        assert.strictEqual(mgr.initialized, true);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// loadInitialData() – Fehlerbehandlung
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – loadInitialData()', () => {

    it('wirft wenn data null ist', () => {
        const mgr = makeManager();
        assert.throws(
            () => mgr.loadInitialData(null),
            /Ungültige Mapping-Datei/
        );
    });

    it('wirft wenn data kein mappings-Array hat', () => {
        const mgr = makeManager();
        assert.throws(
            () => mgr.loadInitialData({ schemaVersion: 1 }),
            /Ungültige Mapping-Datei/
        );
    });

    it('überspringt ungültige Mapping-Einträge ohne zu werfen', () => {
        const mgr = makeManager();

        // Kein Fehler – ungültiger Eintrag wird gewarnt und übersprungen
        assert.doesNotThrow(() => {
            mgr.loadInitialData({
                schemaVersion: 1,
                mappings: [
                    { brickLinkId: null, ldrawPartNumber: '3001' },  // ungültig
                    { brickLinkId: 'BL-VALID', ldrawPartNumber: '3001' }  // gültig
                ]
            });
        });

        assert.ok(mgr.getMapping('BL-VALID'));
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// importCSV() – overwrite: true
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – importCSV() mit overwrite:true', () => {

    it('überschreibt eine bestehende Zuordnung wenn overwrite: true', () => {
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            internalPartId:  'old-id'
        }]);

        const csv = `brickLinkId,ldrawPartNumber,internalPartId\nBL-3001,3001b,new-id`;
        const result = mgr.importCSV(csv, { overwrite: true });

        assert.strictEqual(result.importedCount, 1);
        assert.strictEqual(result.errorCount, 0);
        assert.strictEqual(mgr.getMapping('BL-3001')?.ldrawPartNumber, '3001b');
    });

    it('gibt Fehler zurück wenn overwrite: false (Standard) und ID bereits vorhanden', () => {
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001'
        }]);

        const csv = `brickLinkId,ldrawPartNumber\nBL-3001,3020`;
        const result = mgr.importCSV(csv); // overwrite default = false

        assert.strictEqual(result.errorCount, 1);
        assert.strictEqual(result.importedCount, 0);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// importJSON() – JSON-String-Eingabe
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – importJSON() mit String-Eingabe', () => {

    it('akzeptiert einen JSON-String als Eingabe', () => {
        const mgr = makeManager();
        const jsonStr = JSON.stringify({
            schemaVersion: 1,
            mappings: [
                { brickLinkId: 'BL-3001', ldrawPartNumber: '3001' }
            ]
        });

        const result = mgr.importJSON(jsonStr);

        assert.strictEqual(result.importedCount, 1);
        assert.ok(mgr.getMapping('BL-3001'));
    });

    it('wirft bei ungültigem JSON-String', () => {
        const mgr = makeManager();
        assert.throws(
            () => mgr.importJSON('kein-valid-json'),
            Error
        );
    });

    it('wirft wenn JSON-String kein mappings-Array hat', () => {
        const mgr = makeManager();
        assert.throws(
            () => mgr.importJSON(JSON.stringify({ schemaVersion: 1 })),
            /mappings-Array/
        );
    });
});
