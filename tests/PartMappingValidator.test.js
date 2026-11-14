/**
 * Direkte Tests für PartMappingValidator (alle statischen Methoden)
 *
 * Abdeckung:
 *  - normalizeBrickLinkId()   – alle Randfälle
 *  - normalizeLDrawPartNumber() – alle Randfälle (inkl. .dat strip, .ldr NICHT strip)
 *  - validateStructure()      – alle Fehlerzweige + Happy Path
 *  - validate()               – alle 6 asynchronen Status-Zweige
 *  - STATUSES                 – Vollständigkeitsprüfung
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PartMappingValidator } from '../src/catalog/mapping/PartMappingValidator.js';
import { LDrawPartIndex }       from '../src/catalog/mapping/LDrawPartIndex.js';


// ─── STATUSES ────────────────────────────────────────────────────────────────

describe('PartMappingValidator – STATUSES', () => {

    it('enthält alle erwarteten Status-Konstanten', () => {
        const { STATUSES } = PartMappingValidator;
        assert.strictEqual(STATUSES.AVAILABLE,  'available');
        assert.strictEqual(STATUSES.MISSING,    'missing');
        assert.strictEqual(STATUSES.UNVERIFIED, 'unverified');
        assert.strictEqual(STATUSES.INVALID,    'invalid');
    });

    it('STATUSES ist eingefroren (nicht veränderbar)', () => {
        assert.ok(Object.isFrozen(PartMappingValidator.STATUSES));
    });
});


// ─── normalizeBrickLinkId() ──────────────────────────────────────────────────

describe('PartMappingValidator.normalizeBrickLinkId()', () => {

    it('gibt null zurück für null', () => {
        assert.strictEqual(PartMappingValidator.normalizeBrickLinkId(null), null);
    });

    it('gibt null zurück für undefined', () => {
        assert.strictEqual(PartMappingValidator.normalizeBrickLinkId(undefined), null);
    });

    it('gibt null zurück für leeren String', () => {
        assert.strictEqual(PartMappingValidator.normalizeBrickLinkId(''), null);
    });

    it('gibt null zurück für Whitespace-only String', () => {
        assert.strictEqual(PartMappingValidator.normalizeBrickLinkId('   '), null);
    });

    it('gibt den Wert als String zurück', () => {
        assert.strictEqual(PartMappingValidator.normalizeBrickLinkId('3001'), '3001');
    });

    it('trimmt führende und nachfolgende Leerzeichen', () => {
        assert.strictEqual(PartMappingValidator.normalizeBrickLinkId('  3001  '), '3001');
    });

    it('konvertiert Zahlen zu Strings', () => {
        assert.strictEqual(PartMappingValidator.normalizeBrickLinkId(3001), '3001');
    });
});


// ─── normalizeLDrawPartNumber() ───────────────────────────────────────────────

describe('PartMappingValidator.normalizeLDrawPartNumber()', () => {

    it('gibt null zurück für null', () => {
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber(null), null);
    });

    it('gibt null zurück für undefined', () => {
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber(undefined), null);
    });

    it('gibt null zurück für leeren String', () => {
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber(''), null);
    });

    it('entfernt .dat-Erweiterung (case-insensitive)', () => {
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber('3001.dat'), '3001');
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber('3001.DAT'), '3001');
    });

    it('entfernt .ldr-Erweiterung NICHT (nur .dat wird entfernt)', () => {
        // Nach trim + split + lowercase: 'model.ldr' → enthält Punkt → ungültig → null
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber('model.ldr'), null);
    });

    it('extrahiert Dateinamen aus Pfaden mit Schrägstrich', () => {
        assert.strictEqual(
            PartMappingValidator.normalizeLDrawPartNumber('parts/s/3001s01.dat'),
            '3001s01'
        );
    });

    it('konvertiert Backslashes zu Schrägstrichen vor dem Split', () => {
        assert.strictEqual(
            PartMappingValidator.normalizeLDrawPartNumber('parts\\3001.dat'),
            '3001'
        );
    });

    it('konvertiert Großbuchstaben zu Kleinbuchstaben', () => {
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber('BRICK3001.DAT'), 'brick3001');
    });

    it('gibt null zurück für Teilenummern mit ungültigen Zeichen', () => {
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber('bad part!'), null);
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber('3001?'), null);
    });

    it('akzeptiert Teilenummern mit Bindestrich und Unterstrich', () => {
        assert.strictEqual(PartMappingValidator.normalizeLDrawPartNumber('3001s-01_a'), '3001s-01_a');
    });
});


// ─── validateStructure() ─────────────────────────────────────────────────────

describe('PartMappingValidator.validateStructure()', () => {

    it('gibt INVALID zurück wenn das Mapping kein Objekt ist (null)', () => {
        const result = PartMappingValidator.validateStructure(null);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.status, 'invalid');
    });

    it('gibt INVALID zurück wenn das Mapping kein Objekt ist (String)', () => {
        const result = PartMappingValidator.validateStructure('nicht-ein-objekt');
        assert.strictEqual(result.valid, false);
    });

    it('gibt INVALID zurück wenn brickLinkId fehlt', () => {
        const result = PartMappingValidator.validateStructure({
            ldrawPartNumber: '3001'
        });
        assert.strictEqual(result.valid, false);
        assert.ok(result.reason.includes('BrickLink-ID'));
    });

    it('gibt INVALID zurück wenn brickLinkId null ist', () => {
        const result = PartMappingValidator.validateStructure({
            brickLinkId:     null,
            ldrawPartNumber: '3001'
        });
        assert.strictEqual(result.valid, false);
    });

    it('gibt INVALID zurück wenn brickLinkId ungültige Zeichen enthält (Leerzeichen)', () => {
        const result = PartMappingValidator.validateStructure({
            brickLinkId:     'bad id',
            ldrawPartNumber: '3001'
        });
        assert.strictEqual(result.valid, false);
        assert.ok(result.reason.toLowerCase().includes('ungültige zeichen'));
    });

    it('gibt INVALID zurück wenn ldrawPartNumber fehlt', () => {
        const result = PartMappingValidator.validateStructure({
            brickLinkId: 'BL-3001'
        });
        assert.strictEqual(result.valid, false);
    });

    it('gibt INVALID zurück wenn ldrawPartNumber ungültig ist', () => {
        const result = PartMappingValidator.validateStructure({
            brickLinkId:     'BL-3001',
            ldrawPartNumber: 'invalid!name'
        });
        assert.strictEqual(result.valid, false);
    });

    it('gibt INVALID zurück wenn verified kein Boolean ist (String)', () => {
        const result = PartMappingValidator.validateStructure({
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            verified:        'true'  // String, nicht Boolean
        });
        assert.strictEqual(result.valid, false);
        assert.ok(result.reason.toLowerCase().includes('boolean'));
    });

    it('gibt INVALID zurück wenn internalPartId kein String ist (Zahl)', () => {
        const result = PartMappingValidator.validateStructure({
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            internalPartId:  123   // Zahl, kein String
        });
        assert.strictEqual(result.valid, false);
    });

    it('akzeptiert internalPartId: null (optionales Feld)', () => {
        const result = PartMappingValidator.validateStructure({
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001',
            internalPartId:  null
        });
        assert.strictEqual(result.valid, true);
    });

    it('akzeptiert ein vollständig gültiges Mapping', () => {
        const result = PartMappingValidator.validateStructure({
            brickLinkId:     'BL-3001',
            ldrawPartNumber: '3001.dat',
            verified:        true,
            internalPartId:  'brick_2x4'
        });
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.brickLinkId, 'BL-3001');
        assert.strictEqual(result.ldrawPartNumber, '3001');
    });

    it('normalisiert brickLinkId und ldrawPartNumber im Ergebnis', () => {
        const result = PartMappingValidator.validateStructure({
            brickLinkId:     '  BL-3001  ',
            ldrawPartNumber: 'S/3001S01.DAT'
        });
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.brickLinkId, 'BL-3001');
        assert.strictEqual(result.ldrawPartNumber, '3001s01');
    });
});


// ─── validate() async ────────────────────────────────────────────────────────

describe('PartMappingValidator.validate()', () => {

    const VALID_MAPPING = {
        brickLinkId:     'BL-3001',
        ldrawPartNumber: '3001',
        verified:        false
    };

    it('gibt INVALID zurück wenn validateStructure() fehlschlägt', async () => {
        const result = await PartMappingValidator.validate({
            brickLinkId:     null,
            ldrawPartNumber: '3001'
        }, null);

        assert.strictEqual(result.status, 'invalid');
    });

    it('gibt UNVERIFIED zurück wenn kein ldrawIndex übergeben wird', async () => {
        const result = await PartMappingValidator.validate(VALID_MAPPING, null);

        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.status, 'unverified');
    });

    it('gibt UNVERIFIED zurück wenn ldrawIndex noch nicht geladen', async () => {
        const unloadedIndex = new LDrawPartIndex({ fetchImpl: null });
        // Nicht initialisiert → isLoaded() = false

        const result = await PartMappingValidator.validate(VALID_MAPPING, unloadedIndex);

        assert.strictEqual(result.status, 'unverified');
    });

    it('gibt UNVERIFIED zurück wenn hasPart() null zurückgibt (keine Manifest-Verfügbarkeit)', async () => {
        // Index nach initialize() mit null-fetch: loaded=true, manifestAvailable=false
        const index = new LDrawPartIndex({ fetchImpl: null });
        await index.initialize();

        // hasPart('3001') ruft #checkFile auf → fetchImpl null → gibt null zurück
        const result = await PartMappingValidator.validate(VALID_MAPPING, index);

        assert.strictEqual(result.status, 'unverified');
    });

    it('gibt MISSING zurück wenn LDraw-Datei nicht im Index', async () => {
        const index = LDrawPartIndex.buildFromFileList(['3020.dat']); // 3001 NICHT drin

        const result = await PartMappingValidator.validate(VALID_MAPPING, index);

        assert.strictEqual(result.status, 'missing');
    });

    it('gibt UNVERIFIED zurück wenn Datei im Index aber verified: false', async () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);

        const result = await PartMappingValidator.validate(
            { ...VALID_MAPPING, verified: false },
            index
        );

        assert.strictEqual(result.status, 'unverified');
    });

    it('gibt AVAILABLE zurück wenn Datei im Index und verified: true', async () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);

        const result = await PartMappingValidator.validate(
            { ...VALID_MAPPING, verified: true },
            index
        );

        assert.strictEqual(result.status, 'available');
        assert.strictEqual(result.reason, null);
    });

    it('übergibt normalisierte IDs im Ergebnis weiter', async () => {
        const index = LDrawPartIndex.buildFromFileList(['3001.dat']);

        const result = await PartMappingValidator.validate(
            { brickLinkId: 'BL-3001', ldrawPartNumber: '3001.dat', verified: true },
            index
        );

        assert.strictEqual(result.brickLinkId,     'BL-3001');
        assert.strictEqual(result.ldrawPartNumber, '3001');
    });
});
