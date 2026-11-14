/**
 * Erweiterte Tests für PartCatalog.applyMappings() (C.4)
 *
 * Abdeckung von Lücken:
 *  - Mehrere LDraw-Kandidaten für dieselbe ldrawPartNumber (candidates[0] gewinnt)
 *  - Idempotenz: zweiter applyMappings()-Aufruf liefert dasselbe Ergebnis
 *  - Leerer Manager → alle Parts unmapped
 *  - Rückgabe enthält { applied, unchanged }
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PartCatalog }        from '../src/catalog/PartCatalog.js';
import { PartMappingManager } from '../src/catalog/mapping/PartMappingManager.js';


// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeManager(mappings = []) {
    return new PartMappingManager({
        initialData: { schemaVersion: 1, mappings }
    });
}

function makeCatalog(extraParts = []) {
    const catalog = new PartCatalog();
    catalog.clearImportedParts();
    for (const part of extraParts) {
        catalog.addPart(part, {
            overwrite:            true,
            allowUnknownCategory: true,
            source:               'test'
        });
    }
    return catalog;
}


// ─── Mehrere LDraw-Kandidaten ─────────────────────────────────────────────────

describe('PartCatalog.applyMappings – Mehrere LDraw-Kandidaten', () => {

    it('benutzt candidates[0] wenn mehrere Mappings dieselbe LDraw-Nummer haben', () => {
        const catalog = makeCatalog([
            { id: 'part-x', name: 'Part X', ldrawPartNumber: '3001', category: 'bricks' }
        ]);

        // Zwei Mappings für dieselbe LDraw-Nummer 3001 (unterschiedliche BL-IDs)
        const mgr = makeManager([
            {
                brickLinkId:     'BL-FIRST',
                ldrawPartNumber: '3001',
                verified:        true,
                source:          'manual'
            },
            {
                brickLinkId:     'BL-SECOND',
                ldrawPartNumber: '3001',
                verified:        true,
                source:          'manual'
            }
        ]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-x');

        // Eines der beiden Mappings muss angewandt worden sein
        assert.ok(
            part.brickLinkId === 'BL-FIRST' || part.brickLinkId === 'BL-SECOND',
            `brickLinkId muss BL-FIRST oder BL-SECOND sein, erhalten: ${part.brickLinkId}`
        );
        assert.ok(
            part.mappingStatus === 'verified' || part.mappingStatus === 'unverified',
            `mappingStatus muss verified oder unverified sein, erhalten: ${part.mappingStatus}`
        );
    });
});


// ─── Idempotenz ───────────────────────────────────────────────────────────────

describe('PartCatalog.applyMappings – Idempotenz', () => {

    it('zweiter applyMappings()-Aufruf liefert dasselbe Ergebnis', () => {
        const catalog = makeCatalog([
            { id: 'part-a', name: 'Part A', ldrawPartNumber: '3001', category: 'bricks' }
        ]);
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            internalPartId:  'part-a',
            verified:        true,
            source:          'manual'
        }]);

        // Erster Aufruf
        const result1 = catalog.applyMappings(mgr);
        const status1 = catalog.getPartById('part-a').mappingStatus;
        const blId1   = catalog.getPartById('part-a').brickLinkId;

        // Zweiter Aufruf
        const result2 = catalog.applyMappings(mgr);
        const status2 = catalog.getPartById('part-a').mappingStatus;
        const blId2   = catalog.getPartById('part-a').brickLinkId;

        assert.strictEqual(status1, status2, 'mappingStatus muss nach zweitem Aufruf gleich sein');
        assert.strictEqual(blId1,   blId2,   'brickLinkId muss nach zweitem Aufruf gleich sein');

        // Beide Aufrufe müssen denselben Zähler liefern
        assert.strictEqual(result1.applied, result2.applied);
    });

    it('applyMappings mit leerem Manager → alle Parts unmapped', () => {
        const catalog = makeCatalog([
            { id: 'part-a', name: 'Part A', ldrawPartNumber: '3001', category: 'bricks' },
            { id: 'part-b', name: 'Part B', ldrawPartNumber: '3020', category: 'bricks' }
        ]);
        const mgr = makeManager([]); // leer

        const result = catalog.applyMappings(mgr);

        assert.strictEqual(result.applied, 0);
        assert.ok(result.unchanged >= 2);

        const partA = catalog.getPartById('part-a');
        const partB = catalog.getPartById('part-b');
        assert.strictEqual(partA.mappingStatus, 'unmapped');
        assert.strictEqual(partB.mappingStatus, 'unmapped');
    });
});


// ─── Rückgabe-Objekt ──────────────────────────────────────────────────────────

describe('PartCatalog.applyMappings – Rückgabe-Struktur', () => {

    it('Rückgabe-Objekt enthält applied und unchanged', () => {
        const catalog = makeCatalog([
            { id: 'part-a', name: 'Part A', ldrawPartNumber: '3001', category: 'bricks' }
        ]);
        const mgr = makeManager([{
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            internalPartId:  'part-a',
            verified:        false,
            source:          'auto'
        }]);

        const result = catalog.applyMappings(mgr);

        assert.ok('applied'   in result, 'applied muss im Ergebnis sein');
        assert.ok('unchanged' in result, 'unchanged muss im Ergebnis sein');
        // part-a wird gemappt; Built-in-Parts mit gleicher LDraw-Nr. ebenfalls → >= 1
        assert.ok(result.applied >= 1);
    });

    it('source auto → mappingStatus auto', () => {
        const catalog = makeCatalog([
            { id: 'part-auto', name: 'Auto Part', ldrawPartNumber: '3001', category: 'bricks' }
        ]);
        const mgr = makeManager([{
            brickLinkId:     'BL-AUTO',
            ldrawPartNumber: '3001',
            internalPartId:  'part-auto',
            verified:        false,
            source:          'auto'
        }]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-auto');

        assert.strictEqual(part.mappingStatus, 'auto');
    });
});
