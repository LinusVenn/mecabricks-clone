/**
 * Tests für PartCatalog.applyMappings() (C.4)
 *
 * Prüft:
 *  - Verknüpfung von Katalogeinträgen mit PartMappingManager
 *  - mappingStatus-Werte: 'verified', 'unverified', 'auto', 'unmapped'
 *  - brickLinkId und ldrawPartNumber werden korrekt gesetzt
 *  - Suche per internalPartId (Priorität) und per ldrawPartNumber (Fallback)
 *  - Werte stammen aus echten Mapping-Daten (keine Platzhalter)
 */

import { describe, it, beforeEach } from 'node:test';
import assert            from 'node:assert/strict';
import { PartCatalog }          from '../src/catalog/PartCatalog.js';
import { PartMappingManager }   from '../src/catalog/mapping/PartMappingManager.js';


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


// ═══════════════════════════════════════════════════════════════════════════════
// mappingStatus – Grundfälle
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartCatalog.applyMappings – mappingStatus', () => {

    it('setzt mappingStatus = verified für bestätigte Zuordnung', () => {
        const catalog = makeCatalog([
            { id: 'part-a', name: 'Part A', ldrawPartNumber: '3001', category: 'bricks' }
        ]);
        const mgr = makeManager([
            {
                brickLinkId:     '3001',
                ldrawPartNumber: '3001',
                internalPartId:  'part-a',
                verified:        true,
                source:          'manual'
            }
        ]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-a');

        assert.strictEqual(part.mappingStatus, 'verified');
        assert.strictEqual(part.brickLinkId,   '3001');
    });

    it('setzt mappingStatus = unverified für unbestätigte Zuordnung', () => {
        const catalog = makeCatalog([
            { id: 'part-b', name: 'Part B', ldrawPartNumber: '3020', category: 'bricks' }
        ]);
        const mgr = makeManager([
            {
                brickLinkId:     '3020',
                ldrawPartNumber: '3020',
                internalPartId:  'part-b',
                verified:        false,
                source:          'manual'
            }
        ]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-b');

        assert.strictEqual(part.mappingStatus, 'unverified');
    });

    it('setzt mappingStatus = auto für automatisch ermittelte Zuordnung', () => {
        const catalog = makeCatalog([
            { id: 'part-c', name: 'Part C', ldrawPartNumber: '3069', category: 'bricks' }
        ]);
        const mgr = makeManager([
            {
                brickLinkId:     '3069',
                ldrawPartNumber: '3069',
                internalPartId:  'part-c',
                verified:        false,
                source:          'auto'   // ← auto-Quelle
            }
        ]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-c');

        assert.strictEqual(part.mappingStatus, 'auto');
    });

    it('setzt mappingStatus = unmapped wenn kein Mapping vorhanden', () => {
        const catalog = makeCatalog([
            { id: 'part-unmapped', name: 'Unknown Part', category: 'bricks' }
        ]);
        const mgr = makeManager([]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-unmapped');

        assert.strictEqual(part.mappingStatus, 'unmapped');
        assert.strictEqual(part.brickLinkId,   null);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Suchstrategie – internalPartId vs. ldrawPartNumber
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartCatalog.applyMappings – Suchstrategie', () => {

    it('bevorzugt Mapping per internalPartId vor ldrawPartNumber', () => {
        const catalog = makeCatalog([
            { id: 'part-x', name: 'Part X', ldrawPartNumber: '3001', category: 'bricks' }
        ]);

        // Zwei Mappings: eines per internalPartId (hat andere BrickLink-ID als das LDraw-Mapping)
        const mgr = makeManager([
            {
                brickLinkId:     'BL-BY-INTERNAL',
                ldrawPartNumber: '3001',
                internalPartId:  'part-x',        // direkte Verknüpfung
                verified:        true,
                source:          'manual'
            },
            {
                brickLinkId:     'BL-BY-LDRAW',
                ldrawPartNumber: '3001',
                // kein internalPartId → wird als Fallback verwendet
                verified:        false,
                source:          'manual'
            }
        ]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-x');

        // internalPartId-Mapping gewinnt
        assert.strictEqual(part.brickLinkId, 'BL-BY-INTERNAL');
    });

    it('nutzt Fallback per ldrawPartNumber wenn kein internalPartId-Mapping', () => {
        const catalog = makeCatalog([
            { id: 'part-y', name: 'Part Y', ldrawPartNumber: '3020', category: 'bricks' }
        ]);
        const mgr = makeManager([
            {
                brickLinkId:     'BL-LDRAW-MATCH',
                ldrawPartNumber: '3020',
                verified:        false,
                source:          'manual'
            }
        ]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-y');

        assert.strictEqual(part.brickLinkId, 'BL-LDRAW-MATCH');
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Felder werden korrekt gesetzt
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartCatalog.applyMappings – Feldwerte', () => {

    it('setzt ldrawPartNumber aus Mapping wenn Katalog keinen hat', () => {
        const catalog = makeCatalog([
            // Kein ldrawPartNumber im Katalogeintrag
            { id: 'part-z', name: 'Part Z', category: 'bricks' }
        ]);
        const mgr = makeManager([
            {
                brickLinkId:     'BL-Z',
                ldrawPartNumber: '3001',
                internalPartId:  'part-z',
                verified:        true,
                source:          'manual'
            }
        ]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-z');

        assert.strictEqual(part.ldrawPartNumber, '3001');
        assert.strictEqual(part.brickLinkId,     'BL-Z');
    });

    it('behält vorhandenen ldrawPartNumber wenn Mapping keinen hat', () => {
        const catalog = makeCatalog([
            { id: 'part-q', name: 'Part Q', ldrawPartNumber: '3001', category: 'bricks' }
        ]);
        const mgr = makeManager([
            {
                brickLinkId:     'BL-Q',
                ldrawPartNumber: '',      // leer
                internalPartId:  'part-q',
                verified:        false,
                source:          'manual'
            }
        ]);

        catalog.applyMappings(mgr);
        const part = catalog.getPartById('part-q');

        // ldrawPartNumber aus Katalog bleibt erhalten
        assert.strictEqual(part.ldrawPartNumber, '3001');
    });

    it('brickLinkId ist null wenn kein Mapping gefunden', () => {
        const catalog = makeCatalog([
            { id: 'part-no-bl', name: 'No BL', ldrawPartNumber: '3001', category: 'bricks' }
        ]);
        catalog.applyMappings(makeManager([]));

        const part = catalog.getPartById('part-no-bl');
        assert.strictEqual(part.brickLinkId, null);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Rückgabewert
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartCatalog.applyMappings – Rückgabewert', () => {

    it('gibt applied und unchanged Zähler zurück', () => {
        const catalog = makeCatalog([
            { id: 'p1', name: 'P1', ldrawPartNumber: '3001', category: 'bricks' },
            { id: 'p2', name: 'P2', ldrawPartNumber: '3020', category: 'bricks' }
        ]);
        const mgr = makeManager([
            {
                brickLinkId: 'BL-1', ldrawPartNumber: '3001',
                internalPartId: 'p1', verified: true, source: 'manual'
            }
        ]);

        const { applied, unchanged } = catalog.applyMappings(mgr);

        assert.ok(applied   >= 1, `applied sollte ≥ 1 sein, war ${applied}`);
        assert.ok(unchanged >= 1, `unchanged sollte ≥ 1 sein, war ${unchanged}`);
        assert.strictEqual(applied + unchanged, catalog.getCount());
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Fehlerbehandlung
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartCatalog.applyMappings – Fehlerbehandlung', () => {

    it('wirft Fehler wenn kein MappingManager übergeben wird', () => {
        const catalog = makeCatalog([]);

        assert.throws(() => catalog.applyMappings(null));
        assert.throws(() => catalog.applyMappings(undefined));
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Beispiel aus der Spezifikation
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartCatalog.applyMappings – Spezifikationsbeispiel', () => {

    /**
     * Das Spezifikationsbeispiel zeigt:
     *   { id: 'brick_2x4', ..., brickLinkId: null, ldrawPartNumber: '3001', mappingStatus: 'unverified' }
     *
     * brick_2x4 ist bereits als Built-in mit ldrawPartNumber '3001' registriert (BUILTIN_LDRAW_MAPPING).
     * Das Mapping-Beispiel sagt: brickLinkId: null (keine BrickLink-ID bekannt).
     * Wenn kein Mapping im Manager ist → brickLinkId bleibt null, mappingStatus = 'unmapped'.
     * Wenn ein unverified Mapping ohne internalPartId per ldrawPartNumber gefunden →
     *   mappingStatus = 'unverified'.
     */

    it('brick_2x4 erhält mappingStatus unverified wenn Mapping ldraw-basiert und nicht verified', () => {
        const catalog = new PartCatalog(); // Built-in brick_2x4 vorhanden

        const mgr = makeManager([
            {
                brickLinkId:     'BL-TEST',  // reale BL-ID für Test
                ldrawPartNumber: '3001',      // passt zu brick_2x4
                verified:        false
                // kein internalPartId → Fallback über ldrawPartNumber
            }
        ]);

        catalog.applyMappings(mgr);
        const brick = catalog.getPartById('brick_2x4');

        assert.ok(brick, 'brick_2x4 muss im Katalog existieren');
        assert.strictEqual(brick.ldrawPartNumber, '3001');
        assert.strictEqual(brick.mappingStatus,   'unverified');
        // Wert stammt aus tatsächlichen Mapping-Daten (nicht aus Beispiel)
        assert.strictEqual(brick.brickLinkId, 'BL-TEST');
    });

    it('brick_2x4 erhält mappingStatus unmapped wenn kein Mapping vorhanden', () => {
        const catalog = new PartCatalog();
        catalog.applyMappings(makeManager([]));

        const brick = catalog.getPartById('brick_2x4');
        assert.strictEqual(brick.mappingStatus, 'unmapped');
        assert.strictEqual(brick.brickLinkId,   null);
        assert.strictEqual(brick.ldrawPartNumber, '3001'); // bleibt vom Built-in
    });
});
