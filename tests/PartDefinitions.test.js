import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PART_DEFINITIONS } from '../src/objects/PartDefinitions.js';

describe('PartDefinitions', () => {

    it('enthält alle drei Bauteiltypen', () => {
        assert.ok('brick_2x4' in PART_DEFINITIONS);
        assert.ok('brick_2x2' in PART_DEFINITIONS);
        assert.ok('brick_1x2' in PART_DEFINITIONS);
    });

    it('jede Definition hat id, name, width, depth, height', () => {
        for (const def of Object.values(PART_DEFINITIONS)) {
            assert.ok(def.id, 'id fehlt');
            assert.ok(def.name, 'name fehlt');
            assert.ok(typeof def.width  === 'number', 'width muss Zahl sein');
            assert.ok(typeof def.depth  === 'number', 'depth muss Zahl sein');
            assert.ok(typeof def.height === 'number', 'height muss Zahl sein');
        }
    });

    // Konvention: "2x4" bedeutet 2 Noppen in Tiefe × 4 Noppen in Breite.
    // In der internen Darstellung: width=4, depth=2.
    it('brick_2x4 hat width=4, depth=2', () => {
        assert.strictEqual(PART_DEFINITIONS.brick_2x4.width, 4);
        assert.strictEqual(PART_DEFINITIONS.brick_2x4.depth, 2);
    });

    it('brick_2x2 hat width=2, depth=2', () => {
        assert.strictEqual(PART_DEFINITIONS.brick_2x2.width, 2);
        assert.strictEqual(PART_DEFINITIONS.brick_2x2.depth, 2);
    });

    // brick_1x2: 1 Noppen tief × 2 Noppen breit → width=2, depth=1
    it('brick_1x2 hat width=2, depth=1', () => {
        assert.strictEqual(PART_DEFINITIONS.brick_1x2.width, 2);
        assert.strictEqual(PART_DEFINITIONS.brick_1x2.depth, 1);
    });

    it('alle Definitionen haben konsistente ID (key == id)', () => {
        for (const [key, def] of Object.entries(PART_DEFINITIONS)) {
            assert.strictEqual(def.id, key);
        }
    });

    it('enthält genau 32 Bauteile', () => {
        assert.strictEqual(Object.keys(PART_DEFINITIONS).length, 32);
    });

    it('jede Definition hat ein gültiges geometry-Feld', () => {
        const VALID = new Set(['brick', 'plate', 'tile', 'slope', 'technic', 'window']);
        for (const def of Object.values(PART_DEFINITIONS)) {
            assert.ok(VALID.has(def.geometry), `Unbekannte geometry "${def.geometry}" bei ${def.id}`);
        }
    });

    it('alle width, depth, height-Werte sind positiv', () => {
        for (const def of Object.values(PART_DEFINITIONS)) {
            assert.ok(def.width  > 0, `width <= 0 bei ${def.id}`);
            assert.ok(def.depth  > 0, `depth <= 0 bei ${def.id}`);
            assert.ok(def.height > 0, `height <= 0 bei ${def.id}`);
        }
    });

    it('alle Definitionen haben ein studs-Feld (boolean)', () => {
        for (const def of Object.values(PART_DEFINITIONS)) {
            assert.strictEqual(typeof def.studs, 'boolean', `studs fehlt/falsch bei ${def.id}`);
        }
    });

    it('brick-Definitionen haben studs=true', () => {
        for (const def of Object.values(PART_DEFINITIONS)) {
            if (def.geometry === 'brick') {
                assert.strictEqual(def.studs, true, `${def.id} sollte studs=true haben`);
            }
        }
    });

    it('tile-Definitionen haben studs=false', () => {
        for (const def of Object.values(PART_DEFINITIONS)) {
            if (def.geometry === 'tile') {
                assert.strictEqual(def.studs, false, `${def.id} sollte studs=false haben`);
            }
        }
    });

    it('slope-Definitionen haben studs=false', () => {
        for (const def of Object.values(PART_DEFINITIONS)) {
            if (def.geometry === 'slope') {
                assert.strictEqual(def.studs, false, `${def.id} sollte studs=false haben`);
            }
        }
    });

    it('technic-Definitionen haben studs=false', () => {
        for (const def of Object.values(PART_DEFINITIONS)) {
            if (def.geometry === 'technic') {
                assert.strictEqual(def.studs, false, `${def.id} sollte studs=false haben`);
            }
        }
    });

    // ── Plattenprüfung ────────────────────────────────────────────

    it('plate_2x4 hat height=0.4 (PLATE_HEIGHT)', () => {
        assert.ok(Math.abs(PART_DEFINITIONS.plate_2x4.height - 0.4) < 1e-9);
    });

    it('plate_2x4 hat studs=true', () => {
        assert.strictEqual(PART_DEFINITIONS.plate_2x4.studs, true);
    });

    it('plate_2x4 hat geometry="plate"', () => {
        assert.strictEqual(PART_DEFINITIONS.plate_2x4.geometry, 'plate');
    });

    // ── Fliesenprüfung ───────────────────────────────────────────

    it('tile_1x2 hat studs=false', () => {
        assert.strictEqual(PART_DEFINITIONS.tile_1x2.studs, false);
    });

    it('tile_1x2 hat geometry="tile"', () => {
        assert.strictEqual(PART_DEFINITIONS.tile_1x2.geometry, 'tile');
    });

    it('tile_1x2 hat width=2, depth=1', () => {
        assert.strictEqual(PART_DEFINITIONS.tile_1x2.width, 2);
        assert.strictEqual(PART_DEFINITIONS.tile_1x2.depth, 1);
    });

    // ── Schrägstein ───────────────────────────────────────────────

    it('slope_2x2 hat geometry="slope" und studs=false', () => {
        assert.strictEqual(PART_DEFINITIONS.slope_2x2.geometry, 'slope');
        assert.strictEqual(PART_DEFINITIONS.slope_2x2.studs, false);
    });

    it('slope_2x2 hat width=2, depth=2', () => {
        assert.strictEqual(PART_DEFINITIONS.slope_2x2.width, 2);
        assert.strictEqual(PART_DEFINITIONS.slope_2x2.depth, 2);
    });

    // ── Technic ───────────────────────────────────────────────────

    it('technic_beam_3 hat geometry="technic" und width=3', () => {
        assert.strictEqual(PART_DEFINITIONS.technic_beam_3.geometry, 'technic');
        assert.strictEqual(PART_DEFINITIONS.technic_beam_3.width, 3);
    });

    it('technic_beam_7 hat width=7', () => {
        assert.strictEqual(PART_DEFINITIONS.technic_beam_7.width, 7);
    });

    // ── Fenster / Türen ───────────────────────────────────────────

    it('window_1x2x2 hat geometry="window"', () => {
        assert.strictEqual(PART_DEFINITIONS.window_1x2x2.geometry, 'window');
    });

    it('window_1x2x2 hat height = 2 × BRICK_HEIGHT = 2.4', () => {
        assert.ok(Math.abs(PART_DEFINITIONS.window_1x2x2.height - 2.4) < 1e-9);
    });

    it('door_1x4x6 hat height = 6 × BRICK_HEIGHT = 7.2', () => {
        assert.ok(Math.abs(PART_DEFINITIONS.door_1x4x6.height - 7.2) < 1e-9);
    });

    // ── Kategorienabdeckung ───────────────────────────────────────

    it('enthält mindestens 7 Steine (geometry=brick)', () => {
        const count = Object.values(PART_DEFINITIONS).filter(d => d.geometry === 'brick').length;
        assert.ok(count >= 7, `Nur ${count} Steine gefunden`);
    });

    it('enthält mindestens 7 Platten (geometry=plate)', () => {
        const count = Object.values(PART_DEFINITIONS).filter(d => d.geometry === 'plate').length;
        assert.ok(count >= 7, `Nur ${count} Platten gefunden`);
    });

    it('enthält mindestens 4 Fliesen (geometry=tile)', () => {
        const count = Object.values(PART_DEFINITIONS).filter(d => d.geometry === 'tile').length;
        assert.ok(count >= 4, `Nur ${count} Fliesen gefunden`);
    });

    it('enthält mindestens 2 Schrägsteine (geometry=slope)', () => {
        const count = Object.values(PART_DEFINITIONS).filter(d => d.geometry === 'slope').length;
        assert.ok(count >= 2, `Nur ${count} Schrägsteine gefunden`);
    });

    it('enthält mindestens 3 Technic-Teile (geometry=technic)', () => {
        const count = Object.values(PART_DEFINITIONS).filter(d => d.geometry === 'technic').length;
        assert.ok(count >= 3, `Nur ${count} Technic-Teile gefunden`);
    });

    it('enthält mindestens 2 Fensterbauteile (geometry=window)', () => {
        const count = Object.values(PART_DEFINITIONS).filter(d => d.geometry === 'window').length;
        assert.ok(count >= 2, `Nur ${count} Fensterbauteile gefunden`);
    });

    // ── Vollständigkeitsprüfung der Felder ────────────────────────

    it('alle Definitionen haben ein description-Feld (string)', () => {
        for (const def of Object.values(PART_DEFINITIONS)) {
            assert.ok(
                typeof def.description === 'string' && def.description.length > 0,
                `description fehlt/leer bei ${def.id}`
            );
        }
    });

    it('alle Definitionen haben ein tags-Feld (Array)', () => {
        for (const def of Object.values(PART_DEFINITIONS)) {
            assert.ok(Array.isArray(def.tags), `tags fehlt/kein Array bei ${def.id}`);
            assert.ok(def.tags.length > 0,     `tags ist leer bei ${def.id}`);
        }
    });

    it('alle Definitionen haben ein category-Feld (string)', () => {
        const VALID_CATS = new Set(['bricks', 'plates', 'tiles', 'slopes', 'technic', 'windows']);
        for (const def of Object.values(PART_DEFINITIONS)) {
            assert.ok(
                VALID_CATS.has(def.category),
                `Ungültige category "${def.category}" bei ${def.id}`
            );
        }
    });

});
