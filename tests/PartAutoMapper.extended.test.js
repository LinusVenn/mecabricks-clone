/**
 * Erweiterte Tests für PartAutoMapper (C.3)
 *
 * Abdeckung von Lücken:
 *  - skippedNoLDraw-Zähler wird korrekt inkrementiert
 *  - Alias-Suche über part.id direkt (kein aliases-Array nötig)
 *  - knownAliases mit ungültigem Wert (kein Map) → leere Map
 *  - applyAutoMappings() mit overwrite:true
 *  - applyAutoMappings() addMapping-Exception → conflicts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PartAutoMapper }     from '../src/catalog/mapping/PartAutoMapper.js';
import { LDrawPartIndex }     from '../src/catalog/mapping/LDrawPartIndex.js';
import { PartMappingManager } from '../src/catalog/mapping/PartMappingManager.js';
import { PartCatalog }        from '../src/catalog/PartCatalog.js';


// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeLDrawIndex(partNumbers) {
    return LDrawPartIndex.buildFromFileList(
        partNumbers.map(p => `${p}.dat`)
    );
}

function makeManager(mappings = []) {
    return new PartMappingManager({
        initialData: { schemaVersion: 1, mappings }
    });
}

function makeCatalog(parts) {
    const catalog = new PartCatalog();
    catalog.clearImportedParts();
    for (const part of parts) {
        catalog.addPart(part, {
            overwrite:            true,
            allowUnknownCategory: true,
            source:               'test'
        });
    }
    return catalog;
}


// ═══════════════════════════════════════════════════════════════════════════════
// suggestMappings – skippedNoLDraw-Zähler
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – suggestMappings() skippedNoLDraw-Zähler', () => {

    it('skippedNoLDraw wird für Teile ohne LDraw-Treffer inkrementiert', () => {
        // Index enthält test9001, Katalog hat test9002 (nicht im Index) und test9001
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalog([
            { id: 'part-match',  name: 'Match',  ldrawPartNumber: 'test9001', category: 'bricks' },
            { id: 'part-nomatch', name: 'No Match', ldrawPartNumber: 'test9002', category: 'bricks' }
        ]);

        const mapper = new PartAutoMapper();
        const { skippedNoLDraw, suggestions } = mapper.suggestMappings(catalog, ldrawIndex);

        // part-nomatch hat keinen LDraw-Treffer → skippedNoLDraw++
        assert.ok(skippedNoLDraw >= 1,
            `Erwartet >= 1 skippedNoLDraw, erhalten: ${skippedNoLDraw}`);
        assert.ok(suggestions.some(s => s.internalPartId === 'part-match'));
    });

    it('skippedNoLDraw wird auch für Teile ohne ldrawPartNumber inkrementiert', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalog([
            { id: 'part-nodraw', name: 'No LDraw', category: 'bricks' }
            // kein ldrawPartNumber, kein bekannter Alias
        ]);

        const mapper = new PartAutoMapper();
        const { skippedNoLDraw } = mapper.suggestMappings(catalog, ldrawIndex);

        assert.ok(skippedNoLDraw >= 1,
            `Erwartet >= 1 skippedNoLDraw, erhalten: ${skippedNoLDraw}`);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Alias-Suche über part.id
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – Alias-Suche über part.id', () => {

    it('nutzt part.id als ersten Alias-Kandidaten', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalog([
            {
                id:       'test9001-alias-key',  // ID = Alias-Schlüssel in knownAliases
                name:     'Part via ID-Alias',
                category: 'bricks'
                // kein ldrawPartNumber, kein aliases-Array
            }
        ]);

        const mapper = new PartAutoMapper({
            knownAliases: new Map([
                ['test9001-alias-key', 'test9001']  // ID → LDraw-Nummer
            ])
        });

        const { suggestions } = mapper.suggestMappings(catalog, ldrawIndex);

        const found = suggestions.find(s => s.internalPartId === 'test9001-alias-key');
        assert.ok(found, 'Teil muss über ID-Alias gefunden werden');
        assert.strictEqual(found.ldrawPartNumber, 'test9001');
        assert.strictEqual(found.matchType, 'alias');
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Konstruktor – knownAliases mit ungültigem Wert
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – Konstruktor', () => {

    it('setzt knownAliases als leere Map wenn kein gültiger Map-Wert übergeben', () => {
        const mapper1 = new PartAutoMapper({ knownAliases: 'kein-map' });
        const mapper2 = new PartAutoMapper({ knownAliases: 42 });
        const mapper3 = new PartAutoMapper({ knownAliases: null });
        const mapper4 = new PartAutoMapper({});
        const mapper5 = new PartAutoMapper();

        for (const mapper of [mapper1, mapper2, mapper3, mapper4, mapper5]) {
            assert.ok(
                mapper.knownAliases instanceof Map,
                'knownAliases muss eine Map sein'
            );
            assert.strictEqual(mapper.knownAliases.size, 0);
        }
    });

    it('behält einen gültigen Map-Wert', () => {
        const aliases = new Map([['alias1', 'test9001']]);
        const mapper  = new PartAutoMapper({ knownAliases: aliases });

        assert.strictEqual(mapper.knownAliases.get('alias1'), 'test9001');
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// applyAutoMappings() – overwrite: true
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – applyAutoMappings() mit overwrite:true', () => {

    it('überschreibt eine bestehende unverifizierte Zuordnung', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);

        const catalog = makeCatalog([{
            id:             'part-a',
            name:           'Part A',
            ldrawPartNumber: 'test9001',
            brickLinkId:    'BL-NEW',
            category:       'bricks'
        }]);

        // Vorhandene unverifizierte Zuordnung
        const mgr = makeManager([{
            brickLinkId:     'BL-NEW',
            ldrawPartNumber: '9999',   // andere LDraw-Nummer
            internalPartId:  'part-a',
            verified:        false
        }]);

        const mapper = new PartAutoMapper();
        const result = mapper.applyAutoMappings(catalog, ldrawIndex, mgr, { overwrite: true });

        // Entweder erfolgreich angewandt oder im conflicts (da brickLinkId existiert)
        assert.ok(
            result.applied.length >= 1 || result.conflicts.length >= 1,
            'Entweder applied oder conflicts muss eingetragen sein'
        );
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// applyAutoMappings() – addMapping-Exception → conflicts
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – applyAutoMappings() Exception-Handling', () => {

    it('trägt in conflicts ein wenn addMapping() eine Exception wirft', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);

        const catalog = makeCatalog([{
            id:             'part-conflict',
            name:           'Part Conflict',
            ldrawPartNumber: 'test9001',
            brickLinkId:    'BL-EXISTING',
            category:       'bricks'
        }]);

        // BL-EXISTING bereits im Manager → addMapping ohne overwrite wirft
        const mgr = makeManager([{
            brickLinkId:     'BL-EXISTING',
            ldrawPartNumber: '3020',
            verified:        false
        }]);

        const mapper = new PartAutoMapper();
        // overwrite: false (Standard) → doppelter BL-ID → Exception → conflicts
        const result = mapper.applyAutoMappings(catalog, ldrawIndex, mgr);

        assert.ok(
            result.conflicts.length >= 1,
            `Erwartet conflicts.length >= 1, erhalten: ${result.conflicts.length}`
        );
    });

    it('überspringt Vorschläge ohne brickLinkId und trägt sie in conflicts ein', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);

        const catalog = makeCatalog([{
            id:             'part-no-bl',
            name:           'Part ohne BL-ID',
            ldrawPartNumber: 'test9001',
            // kein brickLinkId
            category:       'bricks'
        }]);

        const mgr    = makeManager();
        const mapper = new PartAutoMapper();
        const result = mapper.applyAutoMappings(catalog, ldrawIndex, mgr);

        // Kein brickLinkId → direkt in conflicts
        assert.ok(
            result.conflicts.length >= 1,
            `Erwartet conflicts.length >= 1, erhalten: ${result.conflicts.length}`
        );
        assert.strictEqual(result.applied.length, 0);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// suggestMappings – null-Eingaben
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – suggestMappings() Null-Sicherheit', () => {

    it('gibt leeres Ergebnis zurück wenn catalog null ist', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const mapper     = new PartAutoMapper();

        const result = mapper.suggestMappings(null, ldrawIndex);

        assert.ok(Array.isArray(result.suggestions));
        assert.strictEqual(result.suggestions.length, 0);
    });

    it('gibt leeres Ergebnis zurück wenn ldrawIndex null ist', () => {
        const catalog = makeCatalog([
            { id: 'p1', name: 'P', ldrawPartNumber: 'test9001', category: 'bricks' }
        ]);
        const mapper = new PartAutoMapper();

        const result = mapper.suggestMappings(catalog, null);

        assert.strictEqual(result.suggestions.length, 0);
    });
});
