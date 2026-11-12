import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PartCatalog } from '../src/library/PartCatalog.js';
import { PART_DEFINITIONS } from '../src/objects/PartDefinitions.js';

// Frische Instanz pro Test (nicht den Singleton verwenden)
function freshCatalog() {
    return new PartCatalog();
}

const TOTAL_PARTS = Object.keys(PART_DEFINITIONS).length;

describe('PartCatalog', () => {

    // ── Konstruktor ────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('erstellt eine Instanz', () => {
            const catalog = freshCatalog();
            assert.ok(catalog instanceof PartCatalog);
        });

        it('lädt alle Bauteile aus PART_DEFINITIONS', () => {
            const catalog = freshCatalog();
            assert.strictEqual(catalog.getAllParts().length, TOTAL_PARTS);
        });
    });


    // ── Singleton ──────────────────────────────────────────────────────

    describe('instance()', () => {

        it('gibt immer dieselbe Instanz zurück', () => {
            const a = PartCatalog.instance();
            const b = PartCatalog.instance();
            assert.strictEqual(a, b);
        });

        it('Instanz enthält alle Bauteile', () => {
            assert.strictEqual(PartCatalog.instance().getAllParts().length, TOTAL_PARTS);
        });
    });


    // ── getAllParts() ──────────────────────────────────────────────────

    describe('getAllParts()', () => {

        it('gibt ein Array zurück', () => {
            assert.ok(Array.isArray(freshCatalog().getAllParts()));
        });

        it('jedes Element hat id, name, width, depth', () => {
            for (const part of freshCatalog().getAllParts()) {
                assert.ok(part.id,                            `id fehlt in ${JSON.stringify(part)}`);
                assert.ok(part.name,                         `name fehlt in ${part.id}`);
                assert.ok(typeof part.width  === 'number',   `width fehlt in ${part.id}`);
                assert.ok(typeof part.depth  === 'number',   `depth fehlt in ${part.id}`);
            }
        });
    });


    // ── getPartById() ─────────────────────────────────────────────────

    describe('getPartById()', () => {

        it('findet brick_2x4', () => {
            const part = freshCatalog().getPartById('brick_2x4');
            assert.ok(part);
            assert.strictEqual(part.id, 'brick_2x4');
        });

        it('gibt undefined für unbekannte ID zurück', () => {
            assert.strictEqual(freshCatalog().getPartById('does_not_exist'), undefined);
        });

        it('gibt undefined für leere ID zurück', () => {
            assert.strictEqual(freshCatalog().getPartById(''), undefined);
        });
    });


    // ── hasPart() ─────────────────────────────────────────────────────

    describe('hasPart()', () => {

        it('gibt true für bekannte ID zurück', () => {
            assert.ok(freshCatalog().hasPart('brick_2x4'));
        });

        it('gibt true für plate_2x4 zurück', () => {
            assert.ok(freshCatalog().hasPart('plate_2x4'));
        });

        it('gibt false für unbekannte ID zurück', () => {
            assert.strictEqual(freshCatalog().hasPart('brick_99x99'), false);
        });
    });


    // ── getPartsByCategory() ──────────────────────────────────────────

    describe('getPartsByCategory()', () => {

        it('liefert nur Bauteile der Kategorie "bricks"', () => {
            const parts = freshCatalog().getPartsByCategory('bricks');
            assert.ok(parts.length > 0);
            for (const p of parts) {
                assert.strictEqual(p.category, 'bricks');
            }
        });

        it('enthält mindestens 7 Steine in "bricks"', () => {
            assert.ok(freshCatalog().getPartsByCategory('bricks').length >= 7);
        });

        it('enthält mindestens 7 Einträge in "plates"', () => {
            assert.ok(freshCatalog().getPartsByCategory('plates').length >= 7);
        });

        it('liefert leeres Array für unbekannte Kategorie', () => {
            assert.deepStrictEqual(freshCatalog().getPartsByCategory('unknown_xyz'), []);
        });

        it('bricks und plates zusammen liefern weniger als TOTAL_PARTS', () => {
            const c = freshCatalog();
            const n = c.getPartsByCategory('bricks').length
                    + c.getPartsByCategory('plates').length;
            assert.ok(n < TOTAL_PARTS);
        });
    });


    // ── getCategories() ───────────────────────────────────────────────

    describe('getCategories()', () => {

        it('gibt ein Array zurück', () => {
            assert.ok(Array.isArray(freshCatalog().getCategories()));
        });

        it('enthält genau 6 Kategorien', () => {
            assert.strictEqual(freshCatalog().getCategories().length, 6);
        });

        it('jede Kategorie hat id und name', () => {
            for (const cat of freshCatalog().getCategories()) {
                assert.ok(cat.id,   `id fehlt: ${JSON.stringify(cat)}`);
                assert.ok(cat.name, `name fehlt: ${cat.id}`);
            }
        });

        it('enthält die Kategorie "bricks"', () => {
            const ids = freshCatalog().getCategories().map(c => c.id);
            assert.ok(ids.includes('bricks'));
        });
    });


    // ── addPart() ─────────────────────────────────────────────────────

    describe('addPart()', () => {

        it('fügt ein neues Bauteil hinzu', () => {
            const catalog = freshCatalog();
            const before  = catalog.getAllParts().length;
            catalog.addPart({ id: 'custom_test_part', name: 'Teststein' });
            assert.strictEqual(catalog.getAllParts().length, before + 1);
            assert.ok(catalog.hasPart('custom_test_part'));
        });

        it('überschreibt ein vorhandenes Bauteil', () => {
            const catalog = freshCatalog();
            catalog.addPart({ id: 'brick_2x4', name: 'Überschriebener Stein' });
            assert.strictEqual(catalog.getPartById('brick_2x4').name, 'Überschriebener Stein');
            // Anzahl bleibt gleich (keine Duplikate)
            assert.strictEqual(catalog.getAllParts().length, TOTAL_PARTS);
        });

        it('wirft einen Fehler wenn id fehlt', () => {
            assert.throws(
                () => freshCatalog().addPart({ name: 'Ohne ID' }),
                { message: /id/ }
            );
        });

        it('wirft einen Fehler wenn definition null ist', () => {
            assert.throws(
                () => freshCatalog().addPart(null),
                { message: /id/ }
            );
        });
    });
});
