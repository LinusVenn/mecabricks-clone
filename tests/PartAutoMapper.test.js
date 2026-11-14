/**
 * Tests für PartAutoMapper (C.3)
 *
 * Prüft:
 *  - Exakte Übereinstimmungen (ldrawPartNumber im Katalog vs. LDraw-Index)
 *  - Alias-Übereinstimmungen
 *  - Manuelle Zuordnungen werden priorisiert (nicht überschrieben)
 *  - Unsichere Treffer werden nicht bestätigt (verified: false)
 *  - applyAutoMappings() überträgt Vorschläge in den Manager
 *
 * Hinweis: Der PartCatalog enthält immer eingebaute Teile (brick_2x4 → 3001,
 * plate_2x4 → 3020, tile_1x2 → 3069). Damit Tests isoliert bleiben,
 * verwenden sie eindeutige Test-LDraw-Nummern, die weder in den Built-ins
 * noch in production-LDraw-Daten erscheinen (Präfix "test9").
 */

import { describe, it } from 'node:test';
import assert            from 'node:assert/strict';
import { PartAutoMapper }       from '../src/catalog/mapping/PartAutoMapper.js';
import { LDrawPartIndex }       from '../src/catalog/mapping/LDrawPartIndex.js';
import { PartMappingManager }   from '../src/catalog/mapping/PartMappingManager.js';
import { PartCatalog }          from '../src/catalog/PartCatalog.js';


// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Erstellt einen LDraw-Index aus einer Liste von Testnummern */
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

/**
 * Erstellt einen Katalog mit nur den angegebenen Teilen.
 * Built-ins (brick_2x4, plate_2x4, tile_1x2) bleiben enthalten –
 * Tests verwenden deshalb LDraw-Nummern mit Präfix "test9".
 */
function makeCatalogWithParts(parts) {
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

/** Findet einen Vorschlag per internalPartId */
function findSuggestion(suggestions, id) {
    return suggestions.find(s => s.internalPartId === id) ?? null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// suggestMappings – Exakte Übereinstimmungen
// (Eindeutige Test-LDraw-Nummern, die nicht in Built-ins erscheinen)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – suggestMappings (exakt)', () => {

    it('schlägt exakte Übereinstimmung vor wenn ldrawPartNumber im Index', () => {
        // test9001 erscheint nicht in Built-ins → isolierter Test
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            { id: 'brick-a', name: 'Brick A', ldrawPartNumber: 'test9001', category: 'bricks' }
        ]);

        const mapper  = new PartAutoMapper();
        const { suggestions } = mapper.suggestMappings(catalog, ldrawIndex);

        // Mindestens brick-a muss als Vorschlag erscheinen
        const found = findSuggestion(suggestions, 'brick-a');
        assert.ok(found, 'brick-a muss in den Vorschlägen sein');
        assert.strictEqual(found.ldrawPartNumber, 'test9001');
        assert.strictEqual(found.matchType,       'exact');
        assert.strictEqual(found.verified,        false);
    });

    it('gibt keinen Vorschlag für das spezifische Teil wenn ldrawPartNumber nicht im Index', () => {
        // Index hat nur test9001, Part hat test9002 (nicht im Index)
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            { id: 'brick-a', name: 'Brick A', ldrawPartNumber: 'test9002', category: 'bricks' }
        ]);

        const mapper = new PartAutoMapper();
        const { suggestions } = mapper.suggestMappings(catalog, ldrawIndex);

        // brick-a darf NICHT in den Vorschlägen sein
        const found = findSuggestion(suggestions, 'brick-a');
        assert.strictEqual(found, null, 'brick-a darf nicht vorgeschlagen werden');
    });

    it('gibt keinen Vorschlag für das spezifische Teil wenn kein ldrawPartNumber vorhanden', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            { id: 'brick-noldraw', name: 'Brick', category: 'bricks' }  // kein ldrawPartNumber
        ]);

        const mapper = new PartAutoMapper();
        const { suggestions } = mapper.suggestMappings(catalog, ldrawIndex);

        const found = findSuggestion(suggestions, 'brick-noldraw');
        assert.strictEqual(found, null, 'brick-noldraw darf nicht vorgeschlagen werden');
    });

    it('alle Vorschläge haben verified: false', () => {
        const ldrawIndex = makeLDrawIndex(['test9001', 'test9002']);
        const catalog    = makeCatalogWithParts([
            { id: 'p1', name: 'P1', ldrawPartNumber: 'test9001', category: 'bricks' },
            { id: 'p2', name: 'P2', ldrawPartNumber: 'test9002', category: 'bricks' }
        ]);

        const mapper = new PartAutoMapper();
        const { suggestions } = mapper.suggestMappings(catalog, ldrawIndex);

        const testSuggestions = suggestions.filter(
            s => s.internalPartId === 'p1' || s.internalPartId === 'p2'
        );
        assert.strictEqual(testSuggestions.length, 2);
        assert.ok(testSuggestions.every(s => s.verified === false),
            'Alle Vorschläge müssen unbestätigt (verified: false) sein');
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// suggestMappings – Alias-Übereinstimmungen
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – suggestMappings (Aliase)', () => {

    it('findet Übereinstimmung über bekannte Aliase', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            {
                id:       'brick-alias',
                name:     'Brick Alias',
                category: 'bricks',
                aliases:  ['my-alias-9001', 'other-alias']
                // kein ldrawPartNumber direkt
            }
        ]);

        const mapper = new PartAutoMapper({
            knownAliases: new Map([
                ['my-alias-9001', 'test9001']   // Alias → LDraw-Nummer
            ])
        });

        const { suggestions } = mapper.suggestMappings(catalog, ldrawIndex);

        const found = findSuggestion(suggestions, 'brick-alias');
        assert.ok(found, 'brick-alias muss über Alias gefunden werden');
        assert.strictEqual(found.ldrawPartNumber, 'test9001');
        assert.strictEqual(found.matchType,       'alias');
        assert.strictEqual(found.verified,        false);
    });

    it('gibt keinen Alias-Vorschlag wenn Ziel-LDraw-Nummer nicht im Index', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            { id: 'b', name: 'B', category: 'bricks', aliases: ['my-alias-9002'] }
        ]);

        const mapper = new PartAutoMapper({
            knownAliases: new Map([['my-alias-9002', 'test9999']])  // test9999 nicht im Index
        });

        const { suggestions } = mapper.suggestMappings(catalog, ldrawIndex);
        const found = findSuggestion(suggestions, 'b');
        assert.strictEqual(found, null);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// applyAutoMappings – Manuelle Zuordnungen priorisieren
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – applyAutoMappings (Priorität)', () => {

    it('überschreibt keine verifizierten manuellen Zuordnungen', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            {
                id: 'brick-manual', name: 'Brick',
                ldrawPartNumber: 'test9001',
                brickLinkId:     'BL-MANUAL',
                category:        'bricks'
            }
        ]);

        // Manuell + verified im Manager
        const mgr = makeManager([
            {
                brickLinkId:     'BL-MANUAL',
                ldrawPartNumber: 'test9001',
                internalPartId:  'brick-manual',
                verified:        true,
                source:          'manual'
            }
        ]);

        const mapper = new PartAutoMapper();
        const { applied, skippedManual } = mapper.applyAutoMappings(
            catalog, ldrawIndex, mgr
        );

        // brick-manual darf nicht in applied sein
        const appliedForManual = applied.filter(
            a => a.internalPartId === 'brick-manual'
        );
        assert.strictEqual(appliedForManual.length, 0);
        assert.ok(skippedManual >= 1);

        // Mapping unverändert
        assert.strictEqual(mgr.getMapping('BL-MANUAL').verified, true);
    });

    it('trägt Vorschlag ein wenn kein Mapping existiert', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            {
                id: 'brick-new', name: 'Brick',
                ldrawPartNumber: 'test9001',
                brickLinkId:     'BL-NEW',
                category:        'bricks'
            }
        ]);

        const mgr    = makeManager();
        const mapper = new PartAutoMapper();

        const { applied } = mapper.applyAutoMappings(catalog, ldrawIndex, mgr);

        const appliedForNew = applied.filter(
            a => a.internalPartId === 'brick-new'
        );
        assert.strictEqual(appliedForNew.length, 1);
        assert.strictEqual(mgr.getMapping('BL-NEW')?.verified, false);
    });

    it('conflicts enthält Einträge ohne BrickLink-ID', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            // Kein brickLinkId im Katalog
            { id: 'brick-x', name: 'Brick', ldrawPartNumber: 'test9001', category: 'bricks' }
        ]);

        const mgr    = makeManager();
        const mapper = new PartAutoMapper();

        const { applied, conflicts } = mapper.applyAutoMappings(catalog, ldrawIndex, mgr);

        // Kein BrickLink-ID bekannt → Konflikt, nicht importiert
        const conflictsForX = conflicts.filter(
            c => c.partId === 'brick-x'
        );
        assert.strictEqual(applied.filter(a => a.internalPartId === 'brick-x').length,  0);
        assert.strictEqual(conflictsForX.length, 1, 'brick-x muss einen Konflikt erzeugen');
    });

    it('neue Einträge erhalten source: auto', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            {
                id: 'b', name: 'B',
                ldrawPartNumber: 'test9001',
                brickLinkId:     'BL-B',
                category:        'bricks'
            }
        ]);

        const mgr    = makeManager();
        const mapper = new PartAutoMapper();
        mapper.applyAutoMappings(catalog, ldrawIndex, mgr);

        const mapping = mgr.getMapping('BL-B');
        assert.strictEqual(mapping?.source, 'auto');
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartAutoMapper – Edge Cases', () => {

    it('gibt leere Suggestions wenn kein Teil im Index vorhanden', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        // Katalog mit Teil, dessen LDraw-Nummer nicht im Index
        const catalog = makeCatalogWithParts([
            { id: 'b', name: 'B', ldrawPartNumber: 'test9999', category: 'bricks' }
        ]);

        const mapper = new PartAutoMapper();
        const { suggestions } = mapper.suggestMappings(catalog, ldrawIndex);

        const found = findSuggestion(suggestions, 'b');
        assert.strictEqual(found, null);
    });

    it('funktioniert ohne ldrawIndex (ldrawIndex = null)', () => {
        const catalog = makeCatalogWithParts([
            { id: 'b', name: 'B', ldrawPartNumber: 'test9001', category: 'bricks' }
        ]);

        const mapper = new PartAutoMapper();
        const { suggestions } = mapper.suggestMappings(catalog, null);

        // Kein Index → keine Vorschläge
        assert.strictEqual(suggestions.length, 0);
    });

    it('gibt Rückgabe-Objekte mit korrekter Struktur', () => {
        const ldrawIndex = makeLDrawIndex(['test9001']);
        const catalog    = makeCatalogWithParts([
            {
                id: 'b', name: 'B',
                ldrawPartNumber: 'test9001',
                brickLinkId:     'BL-B',
                category:        'bricks'
            }
        ]);

        const mapper = new PartAutoMapper();
        const result = mapper.suggestMappings(catalog, ldrawIndex);

        assert.ok('suggestions'    in result);
        assert.ok('skippedManual'  in result);
        assert.ok('skippedNoLDraw' in result);

        const s = findSuggestion(result.suggestions, 'b');
        assert.ok(s);
        assert.ok('internalPartId'  in s);
        assert.ok('ldrawPartNumber' in s);
        assert.ok('brickLinkId'     in s);
        assert.ok('matchType'       in s);
        assert.ok('verified'        in s);
    });
});
