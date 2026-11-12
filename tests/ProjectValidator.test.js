import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ProjectValidator } from '../src/project/ProjectValidator.js';


// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

/** Minimale, gültige Projektdaten für einen Stein. */
function validData(overrides = {}) {
    return {
        format:  'mecabricks-clone',
        version: 1,
        project: {
            id:        'proj-1',
            name:      'Testprojekt',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
        },
        bricks: [
            {
                id:       'brick-1',
                type:     'brick_2x4',
                color:    0xff0000,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
            },
        ],
        connections: [],
        ...overrides,
    };
}

/** Minimal gültige Verbindung zwischen brick-1 und brick-2. */
function validConnection(overrides = {}) {
    return {
        id:            'conn-1',
        sourceBrickId: 'brick-1',
        targetBrickId: 'brick-2',
        type:          'stud-to-bottom',
        position:      null,
        ...overrides,
    };
}

let validator;


// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ProjectValidator', () => {

    validator = new ProjectValidator();


    // ── validate() – Positiv-Fälle ────────────────────────────────────────────

    describe('validate() – gültige Daten', () => {

        it('gibt true zurück für minimale gültige Daten', () => {
            assert.strictEqual(validator.validate(validData()), true);
        });

        it('akzeptiert leere Steinliste', () => {
            assert.strictEqual(
                validator.validate(validData({ bricks: [] })),
                true
            );
        });

        it('akzeptiert mehrere gültige Steine', () => {
            const data = validData({
                bricks: [
                    { id: 'b1', type: 'brick_2x4', color: 0xff0000,
                      position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
                    { id: 'b2', type: 'brick_2x2', color: 0x00ff00,
                      position: { x: 4, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
                ],
            });
            assert.strictEqual(validator.validate(data), true);
        });

        it('akzeptiert Verbindung zwischen zwei vorhandenen Steinen', () => {
            const data = validData({
                bricks: [
                    { id: 'b1', type: 'brick_2x4', color: 0xff0000,
                      position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
                    { id: 'b2', type: 'brick_2x2', color: 0x0000ff,
                      position: { x: 4, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
                ],
                connections: [
                    { id: 'c1', sourceBrickId: 'b1', targetBrickId: 'b2',
                      type: 'stud-to-bottom', position: null },
                ],
            });
            assert.strictEqual(validator.validate(data), true);
        });

        it('akzeptiert Verbindung mit gültiger position', () => {
            const data = validData({
                bricks: [
                    { id: 'b1', type: 'brick_2x4', color: 0xff0000,
                      position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
                    { id: 'b2', type: 'brick_2x2', color: 0x0000ff,
                      position: { x: 4, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
                ],
                connections: [
                    { id: 'c1', sourceBrickId: 'b1', targetBrickId: 'b2',
                      type: 'stud-to-bottom',
                      position: { x: 1, y: 0.5, z: 0 } },
                ],
            });
            assert.strictEqual(validator.validate(data), true);
        });

        it('akzeptiert Farbe 0 (schwarz)', () => {
            const data = validData({
                bricks: [{ id: 'b1', type: 'brick_2x4', color: 0,
                            position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }],
            });
            assert.strictEqual(validator.validate(data), true);
        });

        it('akzeptiert Farbe 0xffffff (weiß)', () => {
            const data = validData({
                bricks: [{ id: 'b1', type: 'brick_2x4', color: 0xffffff,
                            position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }],
            });
            assert.strictEqual(validator.validate(data), true);
        });

    });


    // ── validate() – Grundstruktur ────────────────────────────────────────────

    describe('validate() – Grundstruktur', () => {

        it('wirft für null', () => {
            assert.throws(() => validator.validate(null),
                { message: /Ungültige Projektdatei/ });
        });

        it('wirft für undefined', () => {
            assert.throws(() => validator.validate(undefined),
                { message: /Ungültige Projektdatei/ });
        });

        it('wirft für einen String', () => {
            assert.throws(() => validator.validate('{"format":"mecabricks-clone"}'),
                { message: /Ungültige Projektdatei/ });
        });

        it('wirft für falsches format', () => {
            assert.throws(
                () => validator.validate(validData({ format: 'unbekannt' })),
                { message: /Unbekanntes Projektformat/ }
            );
        });

        it('wirft für falsche version (2)', () => {
            assert.throws(
                () => validator.validate(validData({ version: 2 })),
                { message: /Nicht unterstützte Projektversion/ }
            );
        });

        it('wirft für version als String', () => {
            assert.throws(
                () => validator.validate(validData({ version: '1' })),
                { message: /Nicht unterstützte Projektversion/ }
            );
        });

    });


    // ── validate() – Projektinformationen ────────────────────────────────────

    describe('validate() – Projektinformationen', () => {

        it('wirft wenn project fehlt', () => {
            const data = validData();
            delete data.project;
            assert.throws(() => validator.validate(data),
                { message: /Projektinformationen fehlen/ });
        });

        it('wirft wenn project kein Objekt ist', () => {
            assert.throws(
                () => validator.validate(validData({ project: 'name' })),
                { message: /Projektinformationen fehlen/ }
            );
        });

        it('wirft wenn Projektname fehlt', () => {
            assert.throws(
                () => validator.validate(validData({ project: { id: 'x', name: undefined } })),
                { message: /Projektname fehlt|leer/ }
            );
        });

        it('wirft wenn Projektname nur Leerzeichen enthält', () => {
            assert.throws(
                () => validator.validate(validData({ project: { id: 'x', name: '   ' } })),
                { message: /Projektname fehlt|leer/ }
            );
        });

    });


    // ── validate() – Steinliste ───────────────────────────────────────────────

    describe('validate() – Steine', () => {

        it('wirft wenn bricks fehlt', () => {
            const data = validData();
            delete data.bricks;
            assert.throws(() => validator.validate(data),
                { message: /Steinliste/ });
        });

        it('wirft wenn bricks kein Array ist', () => {
            assert.throws(
                () => validator.validate(validData({ bricks: {} })),
                { message: /Steinliste/ }
            );
        });

        it('wirft wenn ein Stein keine ID hat', () => {
            const data = validData({
                bricks: [{ type: 'brick_2x4', color: 0xff0000,
                            position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } }],
            });
            assert.throws(() => validator.validate(data),
                { message: /keine ID/ });
        });

        it('wirft wenn ein Stein keinen Typ hat', () => {
            const data = validData({
                bricks: [{ id: 'b1', color: 0xff0000,
                            position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } }],
            });
            assert.throws(() => validator.validate(data),
                { message: /Bauteiltyp/ });
        });

        it('wirft bei unbekanntem Bauteiltyp', () => {
            const data = validData({
                bricks: [{ id: 'b1', type: 'brick_99x99', color: 0xff0000,
                            position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } }],
            });
            assert.throws(() => validator.validate(data),
                { message: /Unbekannter Bauteiltyp/ });
        });

        it('wirft bei doppelter Stein-ID', () => {
            const brick = { id: 'same-id', type: 'brick_2x4', color: 0xff0000,
                            position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } };
            const data = validData({ bricks: [brick, { ...brick, color: 0x00ff00 }] });
            assert.throws(() => validator.validate(data),
                { message: /Doppelte Stein-ID/ });
        });

        it('wirft bei negativer Farbe', () => {
            const data = validData({
                bricks: [{ id: 'b1', type: 'brick_2x4', color: -1,
                            position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } }],
            });
            assert.throws(() => validator.validate(data),
                { message: /Farbe/ });
        });

        it('wirft wenn Farbe größer als 0xffffff', () => {
            const data = validData({
                bricks: [{ id: 'b1', type: 'brick_2x4', color: 0x1000000,
                            position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } }],
            });
            assert.throws(() => validator.validate(data),
                { message: /Farbe/ });
        });

        it('wirft wenn Farbe keine ganze Zahl ist', () => {
            const data = validData({
                bricks: [{ id: 'b1', type: 'brick_2x4', color: 1.5,
                            position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } }],
            });
            assert.throws(() => validator.validate(data),
                { message: /Farbe/ });
        });

        it('wirft bei ungültiger Position (NaN)', () => {
            const data = validData({
                bricks: [{ id: 'b1', type: 'brick_2x4', color: 0xff0000,
                            position: { x: NaN, y: 0, z: 0 }, rotation: { x:0, y:0, z:0 } }],
            });
            assert.throws(() => validator.validate(data),
                { message: /Position/ });
        });

        it('wirft bei fehlender Position', () => {
            const data = validData({
                bricks: [{ id: 'b1', type: 'brick_2x4', color: 0xff0000,
                            rotation: { x:0, y:0, z:0 } }],
            });
            assert.throws(() => validator.validate(data),
                { message: /Position/ });
        });

        it('wirft bei ungültiger Rotation (Infinity)', () => {
            const data = validData({
                bricks: [{ id: 'b1', type: 'brick_2x4', color: 0xff0000,
                            position: { x:0, y:0, z:0 },
                            rotation: { x: Infinity, y: 0, z: 0 } }],
            });
            assert.throws(() => validator.validate(data),
                { message: /Rotation/ });
        });

    });


    // ── validate() – Verbindungsliste ────────────────────────────────────────

    describe('validate() – Verbindungen', () => {

        /** Hilfsdaten mit zwei Steinen und einer Verbindung. */
        function twoStones(connOverride = {}) {
            return {
                format: 'mecabricks-clone', version: 1,
                project: { id: 'p1', name: 'Test', createdAt: '', updatedAt: '' },
                bricks: [
                    { id: 'b1', type: 'brick_2x4', color: 0xff0000,
                      position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } },
                    { id: 'b2', type: 'brick_2x2', color: 0x0000ff,
                      position: { x:4, y:0, z:0 }, rotation: { x:0, y:0, z:0 } },
                ],
                connections: [
                    { id: 'c1', sourceBrickId: 'b1', targetBrickId: 'b2',
                      type: 'stud-to-bottom', position: null, ...connOverride },
                ],
            };
        }

        it('wirft wenn connections fehlt', () => {
            const data = validData();
            delete data.connections;
            assert.throws(() => validator.validate(data),
                { message: /Verbindungsliste/ });
        });

        it('wirft wenn connections kein Array ist', () => {
            assert.throws(
                () => validator.validate(validData({ connections: {} })),
                { message: /Verbindungsliste/ }
            );
        });

        it('wirft wenn eine Verbindung keine ID hat', () => {
            assert.throws(
                () => validator.validate(twoStones({ id: undefined })),
                { message: /keine ID/ }
            );
        });

        it('wirft wenn sourceBrickId fehlt', () => {
            assert.throws(
                () => validator.validate(twoStones({ sourceBrickId: undefined })),
                { message: /Steinreferenzen/ }
            );
        });

        it('wirft wenn targetBrickId fehlt', () => {
            assert.throws(
                () => validator.validate(twoStones({ targetBrickId: undefined })),
                { message: /Steinreferenzen/ }
            );
        });

        it('wirft wenn type fehlt', () => {
            assert.throws(
                () => validator.validate(twoStones({ type: undefined })),
                { message: /keinen Typ/ }
            );
        });

        it('wirft bei doppelter Verbindungs-ID', () => {
            const base = twoStones();
            base.connections.push({ ...base.connections[0] }); // selbe ID
            assert.throws(() => validator.validate(base),
                { message: /Doppelte Verbindungs-ID/ });
        });

        it('wirft wenn sourceBrickId nicht existiert', () => {
            assert.throws(
                () => validator.validate(twoStones({ sourceBrickId: 'unknown' })),
                { message: /Quellstein/ }
            );
        });

        it('wirft wenn targetBrickId nicht existiert', () => {
            assert.throws(
                () => validator.validate(twoStones({ targetBrickId: 'unknown' })),
                { message: /Zielstein/ }
            );
        });

        it('wirft bei Selbstverbindung (source === target)', () => {
            assert.throws(
                () => validator.validate(twoStones({ sourceBrickId: 'b1', targetBrickId: 'b1' })),
                { message: /sich selbst/ }
            );
        });

        it('wirft bei ungültiger Verbindungsposition', () => {
            assert.throws(
                () => validator.validate(twoStones({ position: { x: NaN, y: 0, z: 0 } })),
                { message: /Position/ }
            );
        });

    });


    // ── safeValidate() ────────────────────────────────────────────────────────

    describe('safeValidate()', () => {

        it('gibt { valid: true, error: null } für gültige Daten zurück', () => {
            const result = validator.safeValidate(validData());
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, null);
        });

        it('gibt { valid: false, error: string } für ungültige Daten zurück', () => {
            const result = validator.safeValidate(null);
            assert.strictEqual(result.valid, false);
            assert.ok(typeof result.error === 'string');
        });

        it('error-Nachricht beschreibt das Problem', () => {
            const result = validator.safeValidate(validData({ format: 'falsch' }));
            assert.ok(result.error.includes('format') || result.error.length > 0);
        });

        it('wirft selbst nie – auch nicht für völlig falsche Eingaben', () => {
            assert.doesNotThrow(() => validator.safeValidate(42));
            assert.doesNotThrow(() => validator.safeValidate([]));
            assert.doesNotThrow(() => validator.safeValidate('garbage'));
        });

    });

});
