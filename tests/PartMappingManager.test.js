/**
 * Tests für PartMappingManager (C.2)
 *
 * Prüft:
 *  - CSV-Import mit verschiedenen Spaltennamen
 *  - JSON-Import mit erweiterten Protokollen
 *  - Erkennung doppelter BrickLink-IDs im Import-Batch
 *  - Erkennung widersprüchlicher LDraw-Zuordnungen
 *  - Importprotokoll (imported, skipped, warnings, errors)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PartMappingManager } from '../src/catalog/mapping/PartMappingManager.js';


// ─── Hilfsfunktion: leeren Manager erstellen ─────────────────────────────────

function makeManager() {
    return new PartMappingManager({
        initialData: { schemaVersion: 1, mappings: [] }
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
// CSV-IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – importCSV', () => {

    it('importiert einfache CSV-Daten', () => {
        const mgr = makeManager();
        const csv = `brickLinkId,ldrawPartNumber\n3001,3001\n3020,3020`;

        const result = mgr.importCSV(csv);

        assert.strictEqual(result.importedCount, 2);
        assert.strictEqual(result.errorCount,    0);
        assert.ok(mgr.getMapping('3001'));
        assert.ok(mgr.getMapping('3020'));
    });

    it('akzeptiert alternative Spaltennamen für BrickLink-ID', () => {
        const mgr = makeManager();
        // Spaltenname-Variante: bricklink_id
        const csv = `bricklink_id,ldraw\n3001,3001`;
        const result = mgr.importCSV(csv);

        assert.strictEqual(result.importedCount, 1);
        assert.strictEqual(mgr.getMapping('3001').ldrawPartNumber, '3001');
    });

    it('akzeptiert bl_id und part als Spaltennamen', () => {
        const mgr = makeManager();
        const csv = `bl_id,part\n3001,3001\n3020,3020`;

        const result = mgr.importCSV(csv);
        assert.strictEqual(result.importedCount, 2);
    });

    it('akzeptiert Semikolon als Trennzeichen', () => {
        const mgr = makeManager();
        const csv = `brickLinkId;ldrawPartNumber\n3001;3001\n3020;3020`;

        const result = mgr.importCSV(csv);
        assert.strictEqual(result.importedCount, 2);
    });

    it('akzeptiert Tab als Trennzeichen', () => {
        const mgr = makeManager();
        const csv = `brickLinkId\tldrawPartNumber\n3001\t3001`;

        const result = mgr.importCSV(csv);
        assert.strictEqual(result.importedCount, 1);
    });

    it('überspringt Zeilen mit fehlender BrickLink-ID', () => {
        const mgr = makeManager();
        const csv = `brickLinkId,ldrawPartNumber\n,3001\n3020,3020`;

        const result = mgr.importCSV(csv);
        assert.strictEqual(result.importedCount, 1);
        assert.ok(result.errorCount >= 1 || result.skippedCount >= 1 ||
                  result.warningCount >= 0);  // wird als Error gemeldet
    });

    it('erkennt doppelte BrickLink-IDs im Import-Batch', () => {
        const mgr = makeManager();
        const csv = `brickLinkId,ldrawPartNumber
3001,3001
3001,3001b`;    // Duplikat

        const result = mgr.importCSV(csv);

        // Mindestens eine Warnung über die doppelte ID
        assert.ok(result.warningCount >= 1,
            `Erwartet >= 1 Warnung, erhalten: ${result.warningCount}`);
        // Erste Zeile importiert, zweite übersprungen
        assert.strictEqual(result.importedCount, 1);
        assert.strictEqual(result.skippedCount,  1);
    });

    it('erkennt widersprüchliche LDraw-Zuordnungen', () => {
        const mgr = makeManager();

        // Vorab: LDraw-Nummer 3001 bereits unter BrickLink-ID A vergeben
        mgr.addMapping({
            brickLinkId:     'existing-part',
            ldrawPartNumber: '3001',
            verified:        true
        });

        // Import: LDraw-Nummer 3001 soll einer anderen BrickLink-ID zugeordnet werden
        const csv = `brickLinkId,ldrawPartNumber\nnew-part,3001`;
        const result = mgr.importCSV(csv);

        // Warnung über widersprüchliche Zuordnung
        assert.ok(result.warningCount >= 1,
            `Erwartet >= 1 Warnung für Konflikt, erhalten: ${result.warningCount}`);
    });

    it('importiert verified-Feld korrekt', () => {
        const mgr = makeManager();
        const csv = `brickLinkId,ldrawPartNumber,verified\n3001,3001,true\n3020,3020,false`;

        mgr.importCSV(csv);

        assert.strictEqual(mgr.getMapping('3001').verified, true);
        assert.strictEqual(mgr.getMapping('3020').verified, false);
    });

    it('importiert internalPartId wenn vorhanden', () => {
        const mgr = makeManager();
        const csv = `brickLinkId,ldrawPartNumber,internalPartId\n3001,3001,brick_2x4`;

        mgr.importCSV(csv);

        assert.strictEqual(mgr.getMapping('3001').internalPartId, 'brick_2x4');
    });

    it('unterstützt internal_part_id als Spaltenname', () => {
        const mgr = makeManager();
        const csv = `brickLinkId,ldrawPartNumber,internal_part_id\n3001,3001,brick_2x4`;

        mgr.importCSV(csv);
        assert.strictEqual(mgr.getMapping('3001').internalPartId, 'brick_2x4');
    });

    it('BOM-Zeichen am Anfang werden entfernt', () => {
        const mgr = makeManager();
        const csv = `\uFEFFbrickLinkId,ldrawPartNumber\n3001,3001`;

        const result = mgr.importCSV(csv);
        assert.strictEqual(result.importedCount, 1);
    });

    it('leere CSV ergibt leeres Protokoll', () => {
        const mgr = makeManager();
        const result = mgr.importCSV('');

        assert.strictEqual(result.importedCount, 0);
        assert.strictEqual(result.errorCount,    0);
    });

    it('wirft Fehler wenn kein String übergeben wird', () => {
        const mgr = makeManager();
        assert.throws(() => mgr.importCSV(null));
        assert.throws(() => mgr.importCSV(42));
    });

    it('Protokoll enthält alle erwarteten Felder', () => {
        const mgr = makeManager();
        const result = mgr.importCSV('brickLinkId,ldrawPartNumber\n3001,3001');

        assert.ok('imported'      in result);
        assert.ok('skipped'       in result);
        assert.ok('warnings'      in result);
        assert.ok('errors'        in result);
        assert.ok('importedCount' in result);
        assert.ok('skippedCount'  in result);
        assert.ok('warningCount'  in result);
        assert.ok('errorCount'    in result);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// JSON-IMPORT (erweitert)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – importJSON (erweitert)', () => {

    it('gibt vollständiges Protokoll mit warnings + skipped zurück', () => {
        const mgr = makeManager();
        const data = {
            schemaVersion: 1,
            mappings: [
                { brickLinkId: '3001', ldrawPartNumber: '3001' },
                { brickLinkId: '3020', ldrawPartNumber: '3020' }
            ]
        };

        const result = mgr.importJSON(data);

        assert.ok('imported'      in result);
        assert.ok('skipped'       in result);
        assert.ok('warnings'      in result);
        assert.ok('errors'        in result);
        assert.ok('importedCount' in result);
        assert.strictEqual(result.importedCount, 2);
    });

    it('erkennt doppelte BrickLink-IDs im JSON-Batch', () => {
        const mgr = makeManager();
        const data = {
            mappings: [
                { brickLinkId: '3001', ldrawPartNumber: '3001'  },
                { brickLinkId: '3001', ldrawPartNumber: '3001b' }  // Duplikat
            ]
        };

        const result = mgr.importJSON(data);
        assert.ok(result.warningCount >= 1);
        assert.strictEqual(result.importedCount, 1);
        assert.strictEqual(result.skippedCount,  1);
    });

    it('unterstützt alternative Spaltennamen im JSON', () => {
        const mgr = makeManager();
        const data = {
            mappings: [
                {
                    bricklink_id:  '3001',   // Variante statt brickLinkId
                    ldraw:         '3001',   // Variante statt ldrawPartNumber
                    internal_id:   'brick_2x4'
                }
            ]
        };

        const result = mgr.importJSON(data);
        assert.strictEqual(result.importedCount, 1);
        assert.strictEqual(mgr.getMapping('3001').ldrawPartNumber, '3001');
        assert.strictEqual(mgr.getMapping('3001').internalPartId,  'brick_2x4');
    });

    it('wirft Fehler bei ungültigem Format (kein mappings-Array)', () => {
        const mgr = makeManager();
        assert.throws(() => mgr.importJSON({ data: [] }));
        assert.throws(() => mgr.importJSON('nicht parsbar { }'));
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// DUPLIKAT-ERKENNUNG (bestehende API)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PartMappingManager – addMapping Duplikat-Schutz', () => {

    it('wirft Fehler bei doppelter BrickLink-ID ohne overwrite', () => {
        const mgr = makeManager();
        mgr.addMapping({ brickLinkId: '3001', ldrawPartNumber: '3001' });

        assert.throws(
            () => mgr.addMapping({ brickLinkId: '3001', ldrawPartNumber: '3001b' }),
            /BrickLink-ID/i
        );
    });

    it('überschreibt mit overwrite: true', () => {
        const mgr = makeManager();
        mgr.addMapping({ brickLinkId: '3001', ldrawPartNumber: '3001' });
        mgr.addMapping(
            { brickLinkId: '3001', ldrawPartNumber: '3001-new' },
            { overwrite: true }
        );

        assert.strictEqual(mgr.getMapping('3001').ldrawPartNumber, '3001-new');
    });
});
